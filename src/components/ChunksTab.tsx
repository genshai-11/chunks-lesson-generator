import React, { useState, useEffect } from "react";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  getCountFromServer,
  startAfter,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { getDocsWithCache, getDocWithCache } from "../services/cacheService";
import { Chunk, AISettings } from "../types";
import {
  Trash2,
  Volume2,
  Play,
  Loader2,
  Sparkles,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateAudio } from "../services/audioService";
import Papa from "papaparse";

export default function ChunksTab({ aiSettings }: { aiSettings?: AISettings }) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [pageCursors, setPageCursors] = useState<{
    [page: number]: QueryDocumentSnapshot<DocumentData> | null;
  }>({ 1: null });

  // Fetch Total Count
  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const cachedCount = sessionStorage.getItem("chunktab_total_count");
        const cachedTime = sessionStorage.getItem("chunktab_total_count_time");
        const now = Date.now();
        if (cachedCount && cachedTime && now - parseInt(cachedTime) < 1000 * 60 * 60) {
          setTotalChunks(parseInt(cachedCount));
          return;
        }

        const snapshot = await getCountFromServer(
          collection(db, `workspaces/default/chunks`),
        );
        const count = snapshot.data().count;
        setTotalChunks(count);
        sessionStorage.setItem("chunktab_total_count", count.toString());
        sessionStorage.setItem("chunktab_total_count_time", now.toString());
      } catch (err) {
        console.error("Error fetching count:", err);
      }
    };
    fetchTotal();
  }, []);

  // Fetch Page
  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        let q = query(
          collection(db, `workspaces/default/chunks`),
          orderBy("createdAt", "desc"),
          limit(pageSize),
        );

        if (currentPage > 1 && pageCursors[currentPage]) {
          q = query(q, startAfter(pageCursors[currentPage]));
        } else if (currentPage > 1 && !pageCursors[currentPage]) {
          // Fallback: if we jump without cursor, we have to fetch all up to this point
          const skipQ = query(
            collection(db, `workspaces/default/chunks`),
            orderBy("createdAt", "desc"),
            limit((currentPage - 1) * pageSize),
          );
          const skipSnap = await getDocs(skipQ);
          if (!skipSnap.empty) {
            const lastVisible = skipSnap.docs[skipSnap.docs.length - 1];
            q = query(
              collection(db, `workspaces/default/chunks`),
              orderBy("createdAt", "desc"),
              startAfter(lastVisible),
              limit(pageSize),
            );
          }
        }

        // Use getDocsWithCache to save quota!
        const snapshot = await getDocsWithCache(q, `chunktab_page_${currentPage}`, 1000 * 60 * 5);
        
        const chunkData: Chunk[] = [];
        snapshot.forEach((docSnap) =>
          chunkData.push({ id: docSnap.id, ...docSnap.data() } as Chunk),
        );
        setChunks(chunkData);

        if (!snapshot.empty) {
          // Save cursor for the NEXT page
          setPageCursors((prev) => ({
            ...prev,
            [currentPage + 1]: snapshot.docs[snapshot.docs.length - 1],
          }));
        }
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchPage();
  }, [currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalChunks / pageSize));

  // Fix: handle globalMinCvr / globalMaxCvr with static values since we don't have all chunks
  const globalMinCvr = 0;
  const globalMaxCvr = 100;

  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(
    null,
  );

  // Filter state
  interface FilterState {
    difficulties: Set<string>;
    cvrMin: number;
    cvrMax: number;
    audio: "all" | "hasAudio" | "noAudio";
  }
  const defaultFilters: FilterState = {
    difficulties: new Set(),
    cvrMin: 0,
    cvrMax: 10000,
    audio: "all",
  };
  const [pendingFilters, setPendingFilters] =
    useState<FilterState>(defaultFilters);
  const [activeFilters, setActiveFilters] =
    useState<FilterState>(defaultFilters);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGeneratingBulkAudio, setIsGeneratingBulkAudio] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const uniqueDifficulties = React.useMemo(
    () =>
      Array.from(new Set(chunks.map((c) => c.difficultyLabel)))
        .filter(Boolean)
        .sort(),
    [chunks],
  );

  useEffect(() => {
    if (chunks.length > 0 && defaultFilters.cvrMax === 10000) {
      const newDefaults = {
        ...defaultFilters,
        cvrMin: globalMinCvr,
        cvrMax: globalMaxCvr,
      };
      setPendingFilters((prev) => (prev.cvrMax === 10000 ? newDefaults : prev));
      setActiveFilters((prev) => (prev.cvrMax === 10000 ? newDefaults : prev));
    }
  }, [globalMinCvr, globalMaxCvr]);

  const toggleFilter = (type: keyof FilterState, value: any) => {
    setPendingFilters((prev) => {
      if (type === "audio") return { ...prev, audio: value };
      if (type === "cvrMin" || type === "cvrMax")
        return { ...prev, [type]: value };
      const newSet = new Set(prev[type] as Set<any>);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
      return { ...prev, [type]: newSet };
    });
  };

  const applyFilters = () => {
    setActiveFilters(pendingFilters);
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    const resets = {
      ...defaultFilters,
      cvrMin: globalMinCvr,
      cvrMax: globalMaxCvr,
    };
    setPendingFilters(resets);
    setActiveFilters(resets);
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `workspaces/default/chunks`, id));
      setChunks((prev) => prev.filter((c) => c.id !== id));
      setTotalChunks((prev) => prev - 1);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `workspaces/default/chunks/${id}`,
      );
    }
  };

  const handleBulkDelete = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;

    setConfirmModal({
      title: "Confirm Bulk Delete",
      message: `Are you sure you want to delete ${selectedIds.size} selected chunks? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setIsDeletingBulk(true);
        try {
          const batchSize = 400;
          let count = 0;
          let currentBatch = writeBatch(db);

          for (const id of selectedIds) {
            const docRef = doc(db, `workspaces/default/chunks`, id);
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

          setChunks((prev) => prev.filter((c) => !selectedIds.has(c.id)));
          setTotalChunks((prev) => Math.max(0, prev - selectedIds.size));
          setSelectedIds(new Set());
          showToast(`Successfully deleted ${count} chunks.`);
        } catch (error) {
          console.error("Error bulk deleting chunks:", error);
          showToast("Failed to delete chunks.");
        } finally {
          setIsDeletingBulk(false);
        }
      },
    });
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;

    const chunksToExport = chunks
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({
        Category: c.category,
        "English Sentence": c.engSentence,
        "Vietnamese Sentence": c.vieSentence,
        Difficulty: c.difficultyLabel,
        "CVR (Total)": c.uTotal,
        TC: c.rTotal,
        TL: c.tl || "",
        LC: c.lc || "",
        "Bias (I)": c.iValue,
        "Audio URL": c.audioUrl || "N/A",
        "Resources Used": c.resourcesUsed
          .map((r) => (typeof r === "string" ? r : r.name))
          .join(", "),
      }));

    const csv = Papa.unparse(chunksToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `chunks_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePlayAudio = (chunk: Chunk, lang: "en" | "vi" = "en") => {
    const url = lang === "en" ? chunk.audioUrl : chunk.vieAudioUrl;
    if (url) {
      const audio = new Audio(url);
      audio.play();
    } else {
      // Fallback to basic TTS if no audioUrl is stored
      const utterance = new SpeechSynthesisUtterance(
        lang === "en" ? chunk.engSentence : chunk.vieSentence,
      );
      utterance.lang = lang === "en" ? "en-US" : "vi-VN";
      window.speechSynthesis.speak(utterance);
    }
  };

  const getLatestAiSettings = async () => {
    try {
      const docRef = doc(db, `workspaces/default/settings`, "ai");
      const docSnap = await getDocWithCache(docRef, "cvr_ai_settings", 1000 * 60 * 60);
      if (docSnap.exists()) {
        return docSnap.data() as AISettings;
      }
    } catch (error) {
      console.error("Error loading AI settings:", error);
    }
    return undefined;
  };

  const handleGenerateAudio = async (chunk: Chunk) => {
    if (!auth.currentUser) return;
    setGeneratingAudioId(chunk.id);
    try {
      const currentSettings = await getLatestAiSettings();
      // Generate both English and Vietnamese audio concurrently
      const [engAudioUrl, vieAudioUrl] = await Promise.all([
        generateAudio(chunk.engSentence, currentSettings, "eng"),
        generateAudio(chunk.vieSentence, currentSettings, "vie"),
      ]);

      if (engAudioUrl || vieAudioUrl) {
        const updateData: any = {};
        if (engAudioUrl) updateData.audioUrl = engAudioUrl;
        if (vieAudioUrl) updateData.vieAudioUrl = vieAudioUrl;

        await updateDoc(
          doc(db, `workspaces/default/chunks`, chunk.id),
          updateData,
        );
        
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? { ...c, ...updateData } : c
        ));

        showToast("Audio generated successfully");
      }
    } catch (error: any) {
      console.error("Error generating audio:", error);
      showToast(`Generation failed: ${error.message || "Check TTS settings"}`);
    } finally {
      setGeneratingAudioId(null);
    }
  };

  const filteredChunks = React.useMemo(() => {
    return chunks.filter((chunk) => {
      if (
        activeFilters.difficulties.size > 0 &&
        !activeFilters.difficulties.has(chunk.difficultyLabel)
      )
        return false;
      if (
        chunk.uTotal < activeFilters.cvrMin ||
        chunk.uTotal > activeFilters.cvrMax
      )
        return false;
      if (activeFilters.audio === "hasAudio" && !chunk.audioUrl) return false;
      if (activeFilters.audio === "noAudio" && chunk.audioUrl) return false;
      return true;
    });
  }, [chunks, activeFilters]);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredChunks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredChunks.map((c) => c.id)));
    }
  };

  const [bulkAudioType, setBulkAudioType] = useState<
    "missing" | "both" | "eng" | "vie"
  >("missing");

  const handleBulkGenerateAudio = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;
    setIsGeneratingBulkAudio(true);

    const chunksToProcess = chunks.filter((c) => {
      if (!selectedIds.has(c.id)) return false;
      if (bulkAudioType === "missing") return !c.audioUrl || !c.vieAudioUrl;
      return true;
    });

    if (chunksToProcess.length === 0) {
      showToast("No chunks required generation based on your selection.");
      setIsGeneratingBulkAudio(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let lastError = "";

    const currentSettings = await getLatestAiSettings();

    for (const chunk of chunksToProcess) {
      setGeneratingAudioId(chunk.id);
      try {
        const updateData: any = {};

        const shouldGenEng =
          bulkAudioType === "both" ||
          bulkAudioType === "eng" ||
          (bulkAudioType === "missing" && !chunk.audioUrl);
        const shouldGenVie =
          bulkAudioType === "both" ||
          bulkAudioType === "vie" ||
          (bulkAudioType === "missing" && !chunk.vieAudioUrl);

        if (shouldGenEng) {
          const engAudioUrl = await generateAudio(
            chunk.engSentence,
            currentSettings,
            "eng",
          );
          if (engAudioUrl) updateData.audioUrl = engAudioUrl;
        }
        if (shouldGenVie) {
          const vieAudioUrl = await generateAudio(
            chunk.vieSentence,
            currentSettings,
            "vie",
          );
          if (vieAudioUrl) updateData.vieAudioUrl = vieAudioUrl;
        }

        if (Object.keys(updateData).length > 0) {
          await updateDoc(
            doc(db, `workspaces/default/chunks`, chunk.id),
            updateData,
          );
          
          setChunks(prev => prev.map(c => 
            c.id === chunk.id ? { ...c, ...updateData } : c
          ));
          successCount++;
        }
      } catch (error: any) {
        console.error("Error generating audio for chunk", chunk.id, error);
        failCount++;
        lastError = error.message || "Unknown error";
      }
    }

    setGeneratingAudioId(null);
    setIsGeneratingBulkAudio(false);
    setSelectedIds(new Set());

    if (failCount > 0) {
      showToast(
        `Partial bulk generation complete. Success: ${successCount}, Failed: ${failCount}. Last error: ${lastError}`,
      );
    } else {
      showToast(
        `Bulk audio generation successful. Processed ${successCount} items.`,
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-20 left-1/2 z-50 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-full shadow-2xl"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100"
            >
              <h3 className="text-lg font-black text-gray-900 mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-200 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full lg:flex-1">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">
              Database
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                showFilters
                  ? "bg-red-600 text-white shadow-lg shadow-red-100"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-red-300"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showFilters ? "Hide Filters" : "Show Filters"}
              {Object.values(activeFilters).some((v) =>
                v instanceof Set ? v.size > 0 : v !== "all",
              ) && (
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  setPageCursors({ 1: null }); // Reset cursors on page size change
                }}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="p-1 hover:bg-gray-100 disabled:opacity-50 text-gray-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-gray-700 px-2 min-w-[3rem] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages || loading}
                className="p-1 hover:bg-gray-100 disabled:opacity-50 text-gray-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {totalChunks} Total
            </span>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 px-6 py-3 flex items-center justify-between border-b border-blue-100">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} items selected
            </span>
            <div className="flex gap-2">
              <div className="flex items-center bg-blue-600 rounded">
                <select
                  value={bulkAudioType}
                  onChange={(e) => setBulkAudioType(e.target.value as any)}
                  className="bg-transparent text-white text-sm font-medium py-1.5 pl-3 pr-8 border-none focus:ring-0 appearance-none cursor-pointer hover:bg-blue-700 transition-colors rounded-l border-r border-blue-500"
                  disabled={isGeneratingBulkAudio || isDeletingBulk}
                >
                  <option value="missing" className="text-gray-900 bg-white">
                    Missing Audio
                  </option>
                  <option value="both" className="text-gray-900 bg-white">
                    All (EN & VI)
                  </option>
                  <option value="eng" className="text-gray-900 bg-white">
                    English Only
                  </option>
                  <option value="vie" className="text-gray-900 bg-white">
                    Vietnamese Only
                  </option>
                </select>
                <div className="pointer-events-none -ml-6 mr-2 text-white/70">
                  <ChevronDown className="w-4 h-4" />
                </div>
                <button
                  onClick={handleBulkGenerateAudio}
                  disabled={isGeneratingBulkAudio || isDeletingBulk}
                  className="flex items-center px-3 py-1.5 text-white text-sm font-medium rounded-r hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title="Generate based on selection"
                >
                  {isGeneratingBulkAudio ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  Generate
                </button>
              </div>
              <button
                onClick={handleBulkExport}
                disabled={isGeneratingBulkAudio || isDeletingBulk}
                className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isGeneratingBulkAudio || isDeletingBulk}
                className="flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeletingBulk ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading chunks...</div>
        ) : filteredChunks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No chunks found matching your criteria.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            <div className="p-4 bg-gray-50 flex items-center gap-4 border-b border-gray-200">
              <input
                type="checkbox"
                checked={
                  selectedIds.size === filteredChunks.length &&
                  filteredChunks.length > 0
                }
                onChange={handleToggleSelectAll}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All
              </span>
            </div>
            {filteredChunks.map((chunk) => (
              <div
                key={chunk.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${selectedIds.has(chunk.id) ? "bg-red-50/30" : ""}`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(chunk.id)}
                      onChange={() => handleToggleSelect(chunk.id)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase tracking-tight">
                        {chunk.difficultyLabel} • {chunk.uTotal.toFixed(0)}Ω
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-tight">
                        {chunk.category}
                      </span>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        TC: {chunk.rTotal.toFixed(0)} • TL:{" "}
                        {chunk.tl?.toFixed(1) || "N/A"}
                        {chunk.lc ? ` • LC: ${chunk.lc.toFixed(1)}` : ""}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-2 mt-1">
                        <button
                          onClick={() => handleGenerateAudio(chunk)}
                          disabled={generatingAudioId === chunk.id}
                          className={`p-1.5 rounded-full transition-colors flex justify-center items-center ${
                            generatingAudioId === chunk.id
                              ? "bg-gray-100 text-gray-400"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                          title="Generate/Refresh AI Audio (EN & VI)"
                        >
                          {generatingAudioId === chunk.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="flex-1 space-y-3">
                        {/* English Row */}
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handlePlayAudio(chunk, "en")}
                            className={`shrink-0 p-1.5 mt-0.5 rounded-full transition-colors ${
                              chunk.audioUrl
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                            title={
                              chunk.audioUrl
                                ? "Play AI English Audio"
                                : "Play Basic TTS (EN)"
                            }
                          >
                            {chunk.audioUrl ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <p className="text-lg font-medium text-gray-900 leading-snug">
                            {chunk.engSentence}
                          </p>
                        </div>
                        {/* Vietnamese Row */}
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handlePlayAudio(chunk, "vi")}
                            className={`shrink-0 p-1.5 mt-0.5 rounded-full transition-colors ${
                              chunk.vieAudioUrl
                                ? "bg-green-50 text-green-600 hover:bg-green-100"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                            title={
                              chunk.vieAudioUrl
                                ? "Play AI Vietnamese Audio"
                                : "Play Basic TTS (VI)"
                            }
                          >
                            {chunk.vieAudioUrl ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <p className="text-md text-gray-600 leading-snug">
                            {chunk.vieSentence}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {chunk.resourcesUsed.map((resource, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-[10px] rounded border font-medium ${
                            typeof resource === "string"
                              ? "bg-gray-100 text-gray-800 border-gray-200"
                              : resource.color === "Green"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : resource.color === "Blue"
                                  ? "bg-blue-50 text-blue-700 border-blue-100"
                                  : resource.color === "Red"
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : "bg-pink-50 text-pink-700 border-pink-100"
                          }`}
                        >
                          {typeof resource === "string"
                            ? resource
                            : resource.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(chunk.id)}
                    className="text-red-400 hover:text-red-600 p-2"
                    title="Delete Chunk"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="shrink-0"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-6 w-80">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900 tracking-tight uppercase">
                  Filters
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
                {/* CVR (Total Ohm) */}
                <div>
                  <label className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    <span>CVR (Total Ohm)</span>
                    <span className="text-red-600 font-bold">
                      {pendingFilters.cvrMin} - {pendingFilters.cvrMax}
                    </span>
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Min Limit
                      </label>
                      <input
                        type="range"
                        min={globalMinCvr}
                        max={globalMaxCvr}
                        value={pendingFilters.cvrMin}
                        onChange={(e) =>
                          toggleFilter("cvrMin", parseInt(e.target.value))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Max Limit
                      </label>
                      <input
                        type="range"
                        min={globalMinCvr}
                        max={globalMaxCvr}
                        value={pendingFilters.cvrMax}
                        onChange={(e) =>
                          toggleFilter("cvrMax", parseInt(e.target.value))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Audio Status */}
                <div className="border-t border-gray-100 pt-5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Audio Status
                  </label>
                  <div className="space-y-2">
                    {["all", "hasAudio", "noAudio"].map((option) => (
                      <button
                        key={option}
                        onClick={() => toggleFilter("audio", option as any)}
                        className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          pendingFilters.audio === option
                            ? "bg-red-50 border-red-200 text-red-700 shadow-sm"
                            : "bg-white border-gray-200 text-gray-500 hover:border-red-200"
                        }`}
                      >
                        {option === "all"
                          ? "Show All"
                          : option === "hasAudio"
                            ? "Has Audio File"
                            : "No Audio File"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={clearFilters}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-gray-500 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => applyFilters()}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
