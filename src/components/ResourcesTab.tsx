import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Resource, ColorCategory } from '../types';
import { Trash2, Plus, Upload, Sparkles, Loader2, Search, Filter, Edit2, Check, X } from 'lucide-react';
import Papa from 'papaparse';
import { rawNuanceData } from '../data/nuanceData';
import { updateDoc } from 'firebase/firestore';

export default function ResourcesTab() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState<ColorCategory>('Green');
  const [ohm, setOhm] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [stagedResources, setStagedResources] = useState<Partial<Resource>[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof Resource | 'createdAt'; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState<ColorCategory | 'All' | 'Duplicates'>('All');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Resource>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      collection(db, `users/${auth.currentUser.uid}/resources`),
      (snapshot) => {
        const resData: Resource[] = [];
        snapshot.forEach((doc) => {
          resData.push({ id: doc.id, ...doc.data() } as Resource);
        });
        setResources(resData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/resources`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const duplicateIds = React.useMemo(() => {
    const seen = new Map<string, string>();
    const dups = new Set<string>();
    resources.forEach(r => {
      const key = `${r.name.toLowerCase().trim()}-${r.color}`;
      if (seen.has(key)) {
        dups.add(r.id);
        dups.add(seen.get(key)!);
      } else {
        seen.set(key, r.id);
      }
    });
    return dups;
  }, [resources]);

  const filteredResources = React.useMemo(() => {
    let result = resources.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesColor = filterColor === 'All' || 
                          (filterColor === 'Duplicates' ? duplicateIds.has(r.id) : r.color === filterColor);
      return matchesSearch && matchesColor;
    });

    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [resources, searchTerm, filterColor, sortConfig]);

  const handleSort = (key: keyof Resource | 'createdAt') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResources.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, `users/${auth.currentUser!.uid}/resources`, id);
        batch.delete(docRef);
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/resources`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!auth.currentUser || resources.length === 0) return;
    
    setLoading(true);
    try {
      const batchSize = 400;
      let count = 0;
      let currentBatch = writeBatch(db);

      for (const res of resources) {
        const docRef = doc(db, `users/${auth.currentUser.uid}/resources`, res.id);
        currentBatch.delete(docRef);
        count++;

        if (count % batchSize === 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
        }
      }

      if (count % batchSize !== 0) {
        await currentBatch.commit();
      }
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/resources`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkChangeCategory = async (newColor: ColorCategory) => {
    if (!auth.currentUser || selectedIds.size === 0) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, `users/${auth.currentUser!.uid}/resources`, id);
        batch.update(docRef, { color: newColor });
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/resources`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!auth.currentUser || resources.length === 0) return;
    
    const seen = new Map<string, string>(); // "name-color" -> id
    const duplicates: string[] = [];

    resources.forEach(r => {
      const key = `${r.name.toLowerCase().trim()}-${r.color}`;
      if (seen.has(key)) {
        duplicates.push(r.id);
      } else {
        seen.set(key, r.id);
      }
    });

    if (duplicates.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const batchSize = 400;
      let count = 0;
      let currentBatch = writeBatch(db);

      for (const id of duplicates) {
        const docRef = doc(db, `users/${auth.currentUser.uid}/resources`, id);
        currentBatch.delete(docRef);
        count++;

        if (count % batchSize === 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
        }
      }

      if (count % batchSize !== 0) {
        await currentBatch.commit();
      }
      alert(`Removed ${duplicates.length} duplicates.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/resources`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !color || ohm === '' || !auth.currentUser) return;

    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/resources`), {
        name,
        color,
        ohm: Number(ohm),
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setName('');
      setOhm('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/resources`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/resources`, id));
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/resources/${id}`);
    }
  };

  const handleStartEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setEditData({ ...resource });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleUpdateResource = async () => {
    if (!editingId || !auth.currentUser || !editData.name || editData.ohm === undefined) return;

    try {
      const docRef = doc(db, `users/${auth.currentUser.uid}/resources`, editingId);
      await updateDoc(docRef, {
        name: editData.name,
        color: editData.color,
        ohm: Number(editData.ohm)
      });
      setEditingId(null);
      setEditData({});
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/resources/${editingId}`);
    }
  };

  const handleImportNuanceData = async () => {
    if (!auth.currentUser || importing) return;
    setImporting(true);

    try {
      const csvLines = rawNuanceData.split('\n');
      const csvData = csvLines.slice(1).join('\n');

      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
      });

      const validRows = results.data as any[];
      const newStaged: Partial<Resource>[] = [];
      
      for (const row of validRows) {
        const mappings = [
          { key: 'GREEN (Gap fillers)\n...,\n3 Ohm', color: 'Green' as ColorCategory, ohm: 3 },
          { key: 'BLUE (Sentence)\n...\n5 Ohm', color: 'Blue' as ColorCategory, ohm: 5 },
          { key: 'RED (Idioms)\n" "\n7 Ohm', color: 'Red' as ColorCategory, ohm: 7 },
          { key: "PINK (Key terms)\n' '\n1 Ohm", color: 'Pink' as ColorCategory, ohm: 1 },
        ];

        for (const map of mappings) {
          const val = row[map.key];
          if (val && val.trim() && val !== '...') {
            newStaged.push({
              name: val.trim().replace(/^"|"$/g, ''),
              color: map.color,
              ohm: map.ohm,
            });
          }
        }
      }
      setStagedResources(newStaged);
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to parse nuance data.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFromUrl = async () => {
    if (!sheetUrl || !auth.currentUser || importing) return;
    setImporting(true);

    try {
      // Convert view link to export link if necessary
      let exportUrl = sheetUrl;
      if (sheetUrl.includes('/edit')) {
        exportUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!sheetUrl.includes('/export')) {
        exportUrl = `${sheetUrl.replace(/\/$/, '')}/export?format=csv`;
      }

      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error('Failed to fetch Google Sheet');
      const csvText = await response.text();
      
      const csvLines = csvText.split('\n');
      const csvData = csvLines.slice(1).join('\n');

      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
      });

      const validRows = results.data as any[];
      const newStaged: Partial<Resource>[] = [];
      
      for (const row of validRows) {
        const mappings = [
          { key: 'GREEN (Gap fillers)\n...,\n3 Ohm', color: 'Green' as ColorCategory, ohm: 3 },
          { key: 'BLUE (Sentence)\n...\n5 Ohm', color: 'Blue' as ColorCategory, ohm: 5 },
          { key: 'RED (Idioms)\n" "\n7 Ohm', color: 'Red' as ColorCategory, ohm: 7 },
          { key: "PINK (Key terms)\n' '\n1 Ohm", color: 'Pink' as ColorCategory, ohm: 1 },
        ];

        let foundCustom = false;
        // Try custom format first
        const rName = row['Resource_Name'] || row['name'];
        const rColor = row['Color_Category'] || row['color'];
        const rOhm = parseFloat(row['Base_Ohm'] || row['ohm']);
        if (rName && ['Green', 'Blue', 'Pink', 'Red'].includes(rColor) && !isNaN(rOhm)) {
           newStaged.push({ name: rName, color: rColor as ColorCategory, ohm: rOhm });
           foundCustom = true;
        }

        if (!foundCustom) {
          // Try Nuance format
          for (const map of mappings) {
            const val = row[map.key];
            if (val && val.trim() && val !== '...') {
              newStaged.push({
                name: val.trim().replace(/^"|"$/g, ''),
                color: map.color,
                ohm: map.ohm,
              });
            }
          }
        }
      }
      setStagedResources(newStaged);
    } catch (error) {
      console.error("URL Import error:", error);
      alert("Failed to import from URL. Make sure the sheet is public.");
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!auth.currentUser || stagedResources.length === 0) return;
    setImporting(true);

    try {
      const batchSize = 400;
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const res of stagedResources) {
        const docRef = doc(collection(db, `users/${auth.currentUser.uid}/resources`));
        currentBatch.set(docRef, {
          ...res,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
        count++;

        if (count % batchSize === 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
        }
      }

      if (count % batchSize !== 0) {
        await currentBatch.commit();
      }

      alert(`Successfully imported ${count} resources!`);
      setStagedResources([]);
    } catch (error) {
      console.error("Confirm import error:", error);
      alert("Failed to save resources.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validColors = ['Green', 'Blue', 'Pink', 'Red'];
        const newStaged: Partial<Resource>[] = [];
        for (const row of results.data as any[]) {
          const rName = row['Resource_Name'] || row['name'];
          const rColor = row['Color_Category'] || row['color'];
          const rOhm = parseFloat(row['Base_Ohm'] || row['ohm']);

          if (rName && validColors.includes(rColor) && !isNaN(rOhm)) {
            newStaged.push({
              name: rName,
              color: rColor as ColorCategory,
              ohm: rOhm,
            });
          }
        }
        setStagedResources(newStaged);
      }
    });
    e.target.value = '';
  };

  const downloadSample = () => {
    const csvContent = "Resource_Name,Color_Category,Base_Ohm\nExample Resource,Green,3.0\nAnother One,Red,7.0";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_resources.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getColorClass = (c: ColorCategory) => {
    switch (c) {
      case 'Green': return 'bg-green-100 text-green-800 border-green-200';
      case 'Blue': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pink': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Red': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Modals */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Library?</h3>
            <p className="text-sm text-gray-600 mb-6">This will permanently delete all {resources.length} resources. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{resources.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Green</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{resources.filter(r => r.color === 'Green').length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Blue</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{resources.filter(r => r.color === 'Blue').length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Red</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{resources.filter(r => r.color === 'Red').length}</p>
        </div>
        <div className="bg-pink-50 p-4 rounded-xl shadow-sm border border-pink-100">
          <p className="text-xs font-medium text-pink-600 uppercase tracking-wider">Pink</p>
          <p className="text-2xl font-bold text-pink-700 mt-1">{resources.filter(r => r.color === 'Pink').length}</p>
        </div>
        {duplicateIds.size > 0 && (
          <div 
            className="bg-red-100 p-4 rounded-xl shadow-sm border border-red-200 cursor-pointer hover:bg-red-200 transition-colors"
            onClick={() => setFilterColor('Duplicates')}
          >
            <p className="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Duplicates
            </p>
            <p className="text-2xl font-bold text-red-700 mt-1">{duplicateIds.size}</p>
          </div>
        )}
      </div>

      {/* Staging Engine / Preview */}
      {stagedResources.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-amber-900">Import Preview</h3>
              <p className="text-sm text-amber-700">Please verify the data below before seeding to the database.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStagedResources([])}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing}
                className="px-6 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 font-bold text-sm flex items-center shadow-sm"
              >
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Confirm Import ({stagedResources.length} items)
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border border-amber-200 rounded-lg bg-white">
            <table className="min-w-full divide-y divide-amber-100">
              <thead className="bg-amber-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-amber-800 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-amber-800 uppercase">Color</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-amber-800 uppercase">Ohm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {stagedResources.slice(0, 100).map((res, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm text-gray-700">{res.name}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getColorClass(res.color as ColorCategory)}`}>
                        {res.color}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 font-mono">{res.ohm}Ω</td>
                  </tr>
                ))}
                {stagedResources.length > 100 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-xs text-amber-600 italic">
                      ... and {stagedResources.length - 100} more items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-medium text-gray-900">Import & Seed Engine</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center px-4 py-2 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear Library
            </button>
            <button
              onClick={handleRemoveDuplicates}
              className="flex items-center px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clean Duplicates
            </button>
            <button
              onClick={handleImportNuanceData}
              disabled={importing}
              className="flex items-center px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Load Nuance Data
            </button>
            <button
              onClick={downloadSample}
              className="flex items-center px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4 mr-2" /> Sample CSV
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="Paste Google Sheet Link (Public)"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
            />
            <button
              onClick={handleImportFromUrl}
              disabled={!sheetUrl || importing}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center text-sm font-medium disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import Link'}
            </button>
          </div>
          
          <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-6 hover:border-red-300 transition-colors group relative">
            <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
            <div className="text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-red-500 transition-colors" />
              <p className="text-sm font-medium text-gray-700">Click or drag CSV to preview import</p>
              <p className="text-xs text-gray-500 mt-1">Columns: Resource_Name, Color_Category, Base_Ohm</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Manual Add</h3>
        
        <form onSubmit={handleAddResource} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Resource Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
              placeholder="e.g., Apple"
              required
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Color Category</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value as ColorCategory)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
            >
              <option value="Green">Green</option>
              <option value="Blue">Blue</option>
              <option value="Pink">Pink</option>
              <option value="Red">Red</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Ohm (R)</label>
            <input
              type="number"
              value={ohm}
              onChange={(e) => setOhm(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
              placeholder="e.g., 3"
              required
              min="0"
              step="0.1"
            />
          </div>
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center text-sm font-medium h-[38px]"
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-6 py-3 z-10 flex items-center justify-between animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-4">
              <span className="font-bold">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-red-400" />
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-red-100">Move to:</span>
                <select 
                  className="bg-red-700 border-none text-sm rounded px-2 py-1 focus:ring-0 cursor-pointer"
                  onChange={(e) => handleBulkChangeCategory(e.target.value as ColorCategory)}
                  value=""
                >
                  <option value="" disabled>Select Category</option>
                  <option value="Green">Green</option>
                  <option value="Blue">Blue</option>
                  <option value="Pink">Pink</option>
                  <option value="Red">Red</option>
                </select>
              </div>
            </div>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1 bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm font-bold transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
          </div>
        )}

        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-medium text-gray-900">Resource Library</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 w-full sm:w-64"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value as any)}
                className="border border-gray-300 rounded-md text-sm py-2 px-3 focus:ring-red-500 focus:border-red-500"
              >
                <option value="All">All Colors</option>
                <option value="Green">Green</option>
                <option value="Blue">Blue</option>
                <option value="Pink">Pink</option>
                <option value="Red">Red</option>
                <option value="Duplicates">Show Duplicates</option>
              </select>
            </div>
            {duplicateIds.size > 0 && (
              <button
                onClick={handleRemoveDuplicates}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs font-bold shadow-sm"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Clean All Duplicates
              </button>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading resources...</div>
        ) : filteredResources.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm || filterColor !== 'All' ? 'No resources match your filters.' : 'No resources found. Add some above.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      checked={selectedIds.size === filteredResources.length && filteredResources.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('color')}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {sortConfig.key === 'color' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('ohm')}
                  >
                    <div className="flex items-center gap-1">
                      Base Ohm (R)
                      {sortConfig.key === 'ohm' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResources.map((resource) => (
                  <tr key={resource.id} className={`${editingId === resource.id ? 'bg-red-50/30' : ''} ${selectedIds.has(resource.id) ? 'bg-red-50/50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        checked={selectedIds.has(resource.id)}
                        onChange={() => toggleSelect(resource.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingId === resource.id ? (
                        <input
                          type="text"
                          value={editData.name || ''}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500"
                        />
                      ) : (
                        resource.name
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === resource.id ? (
                        <select
                          value={editData.color || 'Green'}
                          onChange={(e) => setEditData({ ...editData, color: e.target.value as ColorCategory })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500"
                        >
                          <option value="Green">Green</option>
                          <option value="Blue">Blue</option>
                          <option value="Pink">Pink</option>
                          <option value="Red">Red</option>
                        </select>
                      ) : (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getColorClass(resource.color)}`}>
                          {resource.color}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === resource.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editData.ohm ?? ''}
                            onChange={(e) => setEditData({ ...editData, ohm: Number(e.target.value) })}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500"
                            step="0.1"
                          />
                          <span>Ω</span>
                        </div>
                      ) : (
                        `${resource.ohm} Ω`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {editingId === resource.id ? (
                          <>
                            <button onClick={handleUpdateResource} className="text-green-600 hover:text-green-900 p-1" title="Save">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 p-1" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleStartEdit(resource)} className="text-red-600 hover:text-red-900 p-1" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {showDeleteConfirm === resource.id ? (
                              <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-200 animate-in fade-in zoom-in duration-200">
                                <button onClick={() => handleDelete(resource.id)} className="text-[10px] font-bold text-red-600 hover:underline">Confirm</button>
                                <button onClick={() => setShowDeleteConfirm(null)} className="text-[10px] font-bold text-gray-500 hover:underline">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setShowDeleteConfirm(resource.id)} className="text-red-600 hover:text-red-900 p-1" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
