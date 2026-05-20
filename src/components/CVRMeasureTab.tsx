import React, { useState, useRef } from "react";
import {
  Loader2,
  Mic,
  Square,
  Upload,
  RefreshCw,
  Edit2,
  Download,
  FileSpreadsheet,
  Plus,
  Check,
} from "lucide-react";
import { transcribeAudio, measureCVR, CVRResult } from "../services/aiService";
import { AISettings, Resource } from "../types";
import { auth } from "../firebase";
import { dataClient } from "../services/dataClient";
import Papa from "papaparse";

interface CsvRow {
  Transcript: string;
  ActualCVR: number;
}

interface CsvResultRow extends CsvRow {
  PredictedCVR: number;
  Error: number;
  EstimatedTC: number;
  LC: number;
  TL: number;
  MatchedTCCount: number;
  MatchedNames: string;
  CandidatesCount: number;
  Candidates: string;
}

export default function CVRMeasureTab({
  resources,
}: {
  resources?: Resource[];
}) {
  const [activeMode, setActiveMode] = useState<"single" | "batch" | "history">(
    "single",
  );

  // Single Mode State
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [status, setStatus] = useState<
    "idle" | "recording" | "transcribing" | "analyzing" | "completed" | "failed"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CVRResult | null>(null);

  // History State
  const [history, setHistory] = useState<any[]>([]);

  // Candidate save state (per-candidate index)
  const [savingCandidates, setSavingCandidates] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});

  // TC display mode and local correction state
  const [useConfirmedTC, setUseConfirmedTC] = useState(false);
  const [baseOhmsState, setBaseOhmsState] = useState<Record<string, number>>({ Green: 5, Blue: 7, Red: 9, Pink: 3 });
  const [editingColors, setEditingColors] = useState<Record<number, string>>({});

  // Batch Mode State
  const [batchResults, setBatchResults] = useState<CsvResultRow[]>([]);
  const [batchStatus, setBatchStatus] = useState<
    "idle" | "processing" | "completed" | "error"
  >("idle");
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const hist = await dataClient.getHistory(20);
        setHistory(hist);
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, []);

  // Always fetch fresh from Supabase (same source as Settings tab saves to)
  const getSettings = async (): Promise<AISettings | undefined> => {
    if (!auth.currentUser) return undefined;
    try {
      const data = await dataClient.getSetting<AISettings>('ai');
      return data || undefined;
    } catch (e) {
      console.error('Failed to load AI settings from Supabase:', e);
    }
    return undefined;
  };

  const getBaseOhms = async (): Promise<Record<string, number> | undefined> => {
    if (!auth.currentUser) return undefined;
    try {
      // Base ohms are now stored inside the 'ai' settings object
      const data = await dataClient.getSetting<AISettings>('ai');
      if (data?.ohmBaseValues) return data.ohmBaseValues as Record<string, number>;
      // Fallback: try legacy separate key
      const legacy = await dataClient.getSetting<Record<string, number>>('baseOhms');
      return legacy || undefined;
    } catch (e) {
      console.error('Failed to load base ohms from Supabase:', e);
    }
    return undefined;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        handleTranscription(blob);
      };

      mediaRecorder.current.start();
      setRecording(true);
      setStatus("recording");
      setError(null);
      setResult(null);
      setTranscript("");
    } catch (err: any) {
      setError("Could not access microphone: " + err.message);
      setStatus("failed");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioUrl(URL.createObjectURL(file));
    setError(null);
    setResult(null);
    setTranscript("");
    handleTranscription(file);
  };

  const handleTranscription = async (blob: Blob) => {
    setStatus("transcribing");
    try {
      const settings = await getSettings();
      const text = await transcribeAudio(blob, settings);
      setTranscript(text);
      setEditedTranscript(text);
      await handleAnalysis(text);
    } catch (err: any) {
      setError("Transcription failed: " + err.message);
      setStatus("failed");
    }
  };

  const handleAnalysis = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) {
      setError("Transcript is empty.");
      setStatus("failed");
      return;
    }
    setStatus("analyzing");
    try {
      const [settings, baseOhms, tcCorrections] = await Promise.all([
        getSettings(),
        getBaseOhms(),
        dataClient.getTcCorrections().catch(() => []),
      ]);
      if (baseOhms) setBaseOhmsState(baseOhms as Record<string, number>);
      const analysisResult = await measureCVR(
        textToAnalyze,
        settings,
        baseOhms,
        resources,
        tcCorrections,
      );
      setResult(analysisResult);
      setStatus("completed");

      // Auto save to history (Supabase) and refresh list
      try {
        const saved = await dataClient.createHistory({
          transcript: textToAnalyze,
          predictedCVR: analysisResult.predictedCVR,
          estimatedTC: analysisResult.tcBreakdown.estimatedTC,
          lcValue: analysisResult.lcBreakdown.lcValue,
          tlValue: analysisResult.tlBreakdown.tlValue,
          matchedNames: analysisResult.tcBreakdown.matchedResources?.map(m => m.text).join(", ") || "",
          calculationString: analysisResult.calculationString,
        });
        setHistory(prev => [saved, ...prev]);
      } catch (histErr) {
        console.error("Failed to save CVR history:", histErr);
      }
    } catch (err: any) {
      setError("Analysis failed: " + err.message);
      setStatus("failed");
    }
  };

  const resetSingleMode = () => {
    setAudioUrl(null);
    setTranscript("");
    setEditedTranscript("");
    setResult(null);
    setStatus("idle");
    setError(null);
    setSavingCandidates({});
    setEditingColors({});
    setUseConfirmedTC(false);
  };

  const handleSaveCandidate = async (candidate: any, idx: number) => {
    const color = editingColors[idx] || candidate.color;
    const ohm = baseOhmsState[color] ?? candidate.ohm;
    setSavingCandidates(prev => ({ ...prev, [idx]: 'saving' }));
    try {
      await dataClient.createResource({ name: candidate.text, color, ohm });
      // Save correction for AI learning
      dataClient.saveTcCorrection({
        sentence_fragment: candidate.text,
        resource_name: candidate.text,
        color,
        ohm,
        context: transcript.slice(0, 120),
      }).catch(() => {});
      setSavingCandidates(prev => ({ ...prev, [idx]: 'saved' }));
    } catch (e) {
      console.error('Failed to save candidate resource:', e);
      setSavingCandidates(prev => ({ ...prev, [idx]: 'error' }));
    }
  };

  const applyToTC = (candidate: any, idx: number) => {
    if (!result) return;
    const color = editingColors[idx] || candidate.color;
    const ohm = baseOhmsState[color] ?? candidate.ohm;
    const promoted = { ...candidate, color, ohm, type: 'matched' };

    const newMatched = [...result.tcBreakdown.matchedResources, promoted];
    const newCandidates = result.tcBreakdown.candidateResources.filter((_, i) => i !== idx);
    const newConfirmedTC = newMatched.reduce((acc: number, r: any) => acc + r.ohm, 0);

    const maxSlots: Record<string, number> = { 'Very Short': 1, 'Short': 2, 'Medium': 3, 'Long': 4 };
    const band = result.lcBreakdown.lengthBand;
    const maxAllowed = maxSlots[band] || 4;

    const allRes = [
      ...newMatched.map((m: any) => ({ ...m, type: 'matched' })),
      ...newCandidates.map((c: any) => ({ ...c, type: 'candidate' })),
    ].sort((a, b) => {
      if (a.type === 'matched' && b.type !== 'matched') return -1;
      if (a.type !== 'matched' && b.type === 'matched') return 1;
      return b.ohm - a.ohm;
    });

    const included = allRes.slice(0, maxAllowed);
    const overflow = allRes.slice(maxAllowed);
    const newEstimatedTC = included.reduce((acc: number, r: any) => acc + r.ohm, 0);

    let calcStr = included.map((r: any) => `${r.ohm} (${r.type})`).join(' + ');
    if (overflow.length > 0) calcStr += ` ... [+${overflow.length} overflow item(s) ignored]`;
    const calculation = `${calcStr} = ${newEstimatedTC} (Capped at ${maxAllowed} slots for ${band})`;

    setResult(prev => prev ? {
      ...prev,
      tcBreakdown: {
        ...prev.tcBreakdown,
        matchedResources: newMatched,
        candidateResources: newCandidates,
        confirmedTC: newConfirmedTC,
        estimatedTC: newEstimatedTC,
        calculation,
      },
    } : null);

    setEditingColors(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setSavingCandidates(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const handleManualAnalyze = () => {
    setTranscript(editedTranscript);
    setIsEditingTranscript(false);
    handleAnalysis(editedTranscript);
  };

  // Batch Methods
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBatchStatus("processing");
    setBatchResults([]);
    setError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          setError("CSV is empty");
          setBatchStatus("error");
          return;
        }

        if (!rows[0].Transcript || rows[0].ActualCVR === undefined) {
          setError('CSV must contain "Transcript" and "ActualCVR" columns');
          setBatchStatus("error");
          return;
        }

        const settings = await getSettings();
        const baseOhms = await getBaseOhms();
        const outList: CsvResultRow[] = [];

        setBatchProgress({ current: 0, total: rows.length });

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const res = await measureCVR(
              row.Transcript,
              settings,
              baseOhms,
              resources,
            );
            const actual = Number(row.ActualCVR) || 0;
            const pred = res.predictedCVR || 0;
            outList.push({
              Transcript: row.Transcript,
              ActualCVR: actual,
              PredictedCVR: pred,
              Error: Number((pred - actual).toFixed(2)),
              EstimatedTC: res.tcBreakdown?.estimatedTC || 0,
              LC: res.lcBreakdown?.lcValue || 1,
              TL: res.tlBreakdown?.tlValue || 1,
              MatchedTCCount: res.tcBreakdown?.matchedResources?.length || 0,
              MatchedNames: res.tcBreakdown?.matchedResources?.map(m => m.text).join(", ") || "",
              CandidatesCount: res.tcBreakdown?.candidateResources?.length || 0,
              Candidates:
                res.tcBreakdown?.candidateResources
                  ?.map((c) => c.text)
                  .join(", ") || "",
            });
          } catch (err) {
            console.error(err);
            outList.push({
              Transcript: row.Transcript,
              ActualCVR: Number(row.ActualCVR),
              PredictedCVR: 0,
              Error: 0,
              EstimatedTC: 0,
              LC: 0,
              TL: 0,
              MatchedTCCount: 0,
              MatchedNames: "",
              CandidatesCount: 0,
              Candidates: "ERROR",
            });
          }
          setBatchProgress({ current: i + 1, total: rows.length });
        }

        setBatchResults(outList);
        setBatchStatus("completed");

        // Save all batch results to Supabase history
        const newEntries: any[] = [];
        for (const row of outList) {
          if (row.Candidates === "ERROR") continue;
          try {
            const saved = await dataClient.createHistory({
              transcript: row.Transcript,
              predictedCVR: row.PredictedCVR,
              estimatedTC: row.EstimatedTC,
              lcValue: row.LC,
              tlValue: row.TL,
              matchedNames: row.MatchedNames,
              calculationString: `${row.EstimatedTC} × ${row.LC} × ${row.TL} = ${row.PredictedCVR}`,
              payload: { batchActualCVR: row.ActualCVR },
            });
            newEntries.push(saved);
          } catch (e) {
            console.error("Failed to save batch row to history:", e);
          }
        }
        if (newEntries.length > 0) {
          setHistory(prev => [...newEntries.reverse(), ...prev]);
        }
      },
      error: (err) => {
        setError(err.message);
        setBatchStatus("error");
      },
    });
  };

  const exportCsv = () => {
    if (batchResults.length === 0) return;
    const csv = Papa.unparse(batchResults);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "cvr_measure_results.csv");
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              CVR Measure Engine
            </h2>
            <p className="text-sm text-gray-500">
              Reverse-measure Transcript to Predict CVR
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveMode("single")}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeMode === "single" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"}`}
            >
              Single Input
            </button>
            <button
              onClick={() => setActiveMode("batch")}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${activeMode === "batch" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"}`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Batch CSV
            </button>
            <button
              onClick={() => setActiveMode("history")}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${activeMode === "history" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"}`}
            >
              History
            </button>
          </div>
        </div>

        {activeMode === "single" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center min-h-[200px]">
                {recording ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                      <Mic className="w-8 h-8 text-red-600" />
                    </div>
                    <span className="text-red-600 font-medium">
                      Recording...
                    </span>
                    <button
                      onClick={stopRecording}
                      className="px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center shadow-lg"
                    >
                      <Square className="w-4 h-4 mr-2" /> Stop
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <button
                      onClick={startRecording}
                      className="w-16 h-16 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                    >
                      <Mic className="w-8 h-8" />
                    </button>
                    <span className="text-gray-600 font-medium">
                      Click to Record
                    </span>

                    <div className="flex items-center w-full max-w-xs my-2">
                      <div className="flex-1 border-t border-gray-300" />
                      <span className="px-3 text-xs text-gray-400 uppercase">
                        or
                      </span>
                      <div className="flex-1 border-t border-gray-300" />
                    </div>

                    <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium">
                      <Upload className="w-4 h-4 mr-2" /> Audio / Text
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                )}
              </div>

              {audioUrl && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              )}

              {["transcribing", "analyzing"].includes(status) && (
                <div className="flex items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  <span className="font-medium capitalize">{status}...</span>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 h-full flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800">
                    Measurement Transcript
                  </h3>
                  {transcript && !isEditingTranscript && (
                    <button
                      onClick={() => setIsEditingTranscript(true)}
                      className="text-xs flex items-center text-gray-500 hover:text-gray-900"
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </button>
                  )}
                </div>

                {isEditingTranscript ? (
                  <div className="flex-1 flex flex-col">
                    <textarea
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      className="flex-1 w-full p-3 border border-gray-300 rounded-lg text-sm resize-none mb-3"
                      rows={5}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditingTranscript(false);
                          setEditedTranscript(transcript);
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleManualAnalyze}
                        className="px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-lg flex items-center"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Measure CVR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    {transcript ? (
                      <p className="text-gray-700 text-lg leading-relaxed">
                        {transcript}
                      </p>
                    ) : (
                      <p className="text-gray-400 italic text-sm text-center mt-10">
                        Paste transcript or upload audio
                      </p>
                    )}

                    {!transcript && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => setIsEditingTranscript(true)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100"
                        >
                          Paste Text Instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMode === "batch" && (
          <div className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-blue-800">
              <p>
                Upload a CSV file with columns <strong>Transcript</strong> and{" "}
                <strong>ActualCVR</strong>.
              </p>
              <p>
                The engine will measure CVR for each row and output Predicted
                CVR and Error rates.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium">
                <Upload className="w-4 h-4 mr-2" /> Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                  disabled={batchStatus === "processing"}
                />
              </label>

              {batchStatus === "processing" && (
                <div className="flex items-center text-blue-600 text-sm font-medium">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing {batchProgress.current} / {batchProgress.total}
                </div>
              )}

              {batchStatus === "completed" && (
                <button
                  onClick={exportCsv}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm font-medium"
                >
                  <Download className="w-4 h-4 mr-2" /> Download Report
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {batchResults.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Transcript</th>
                      <th className="px-4 py-3">Actual CVR</th>
                      <th className="px-4 py-3">Predicted</th>
                      <th className="px-4 py-3">Error</th>
                      <th className="px-4 py-3">Est. TC</th>
                      <th className="px-4 py-3">LC</th>
                      <th className="px-4 py-3">TL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {batchResults.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td
                          className="px-4 py-3 truncate max-w-[200px]"
                          title={row.Transcript}
                        >
                          {row.Transcript}
                        </td>
                        <td className="px-4 py-3 font-mono">{row.ActualCVR}</td>
                        <td className="px-4 py-3 font-mono text-indigo-600">
                          {row.PredictedCVR}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${Math.abs(row.Error) > 5 ? "text-red-500" : "text-green-500"}`}
                        >
                          {row.Error > 0 ? "+" : ""}
                          {row.Error}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {row.EstimatedTC}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{row.LC}</td>
                        <td className="px-4 py-3 text-gray-500">{row.TL}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {batchResults.length > 10 && (
                  <div className="p-3 text-center text-gray-500 text-xs bg-gray-50">
                    Showing first 10 rows. Download to see all{" "}
                    {batchResults.length} rows.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeMode === "single" && result && (() => {
        const displayedTC = useConfirmedTC ? result.tcBreakdown.confirmedTC : result.tcBreakdown.estimatedTC;
        const displayedCVR = Math.round(displayedTC * result.lcBreakdown.lcValue * result.tlBreakdown.tlValue);
        const displayedCalcStr = `${displayedTC} (TC ${useConfirmedTC ? 'Confirmed' : 'Est.'}) × ${result.lcBreakdown.lcValue} (LC) × ${result.tlBreakdown.tlValue} (TL) = ${displayedCVR}`;
        return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold text-gray-900">Predicted CVR</h3>
              <p className="text-sm text-gray-500 font-mono mt-1">
                {displayedCalcStr}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs ${useConfirmedTC ? 'text-gray-400' : 'font-semibold text-indigo-600'}`}>Estimated</span>
                <button
                  onClick={() => setUseConfirmedTC(p => !p)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useConfirmedTC ? 'bg-green-500' : 'bg-indigo-400'}`}
                  title="Toggle between Estimated TC and Confirmed TC only"
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${useConfirmedTC ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
                <span className={`text-xs ${useConfirmedTC ? 'font-semibold text-green-600' : 'text-gray-400'}`}>Confirmed only</span>
              </div>
            </div>
            <div className="text-5xl font-black text-indigo-600 tracking-tight flex items-center gap-4">
              {displayedCVR}
              <button
                onClick={resetSingleMode}
                className="text-sm font-medium bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200"
              >
                Start New Sentence
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-red-600">TC Breakdown</h4>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-gray-400 leading-none">Confirmed</span>
                  <span className="font-mono bg-green-50 text-green-700 px-2 rounded text-sm">
                    {result.tcBreakdown?.confirmedTC ?? 0}Ω
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-gray-400 leading-none">Estimated</span>
                  <span className="font-mono bg-red-50 text-red-700 px-2 rounded text-sm">
                    {result.tcBreakdown?.estimatedTC}Ω
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {result.tcBreakdown?.calculation}
            </p>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {result.tcBreakdown?.matchedResources &&
                result.tcBreakdown.matchedResources.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">
                      Matched Resources
                    </h5>
                    <div className="space-y-2">
                      {result.tcBreakdown.matchedResources.map(
                        (m: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-sm border border-green-100 p-2 rounded bg-green-50/50"
                          >
                            <div className="flex justify-between">
                              <span className="font-bold text-green-900">
                                {m.text}
                              </span>
                              <span className="text-xs px-1 bg-white border border-green-200 rounded text-green-700">
                                {m.color} {m.ohm}Ω
                              </span>
                            </div>
                            {m.reasoning && (
                              <p className="text-xs text-gray-500 italic mt-1">
                                {m.reasoning}
                              </p>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              <div>
                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                  <span>Resource Candidates</span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded-full flex items-center">
                    Predict
                  </span>
                </h5>
                <div className="space-y-2">
                  {result.tcBreakdown?.candidateResources?.map(
                    (c: any, idx: number) => {
                      const activeColor = editingColors[idx] || c.color;
                      const activeOhm = baseOhmsState[activeColor] ?? c.ohm;
                      const COLOR_OPTIONS = ['Green', 'Blue', 'Red', 'Pink'];
                      return (
                        <div
                          key={idx}
                          className="text-sm border border-red-100 p-2 rounded bg-red-50/50"
                        >
                          <div className="flex justify-between items-start mb-1 gap-1">
                            <span className="font-bold text-red-900 flex-1 min-w-0">{c.text}</span>
                            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                              <select
                                value={activeColor}
                                onChange={e => setEditingColors(prev => ({ ...prev, [idx]: e.target.value }))}
                                className="text-xs border border-red-200 rounded bg-white text-red-700 py-0.5 px-1 cursor-pointer"
                              >
                                {COLOR_OPTIONS.map(col => (
                                  <option key={col} value={col}>{col} {baseOhmsState[col] ?? '?'}Ω</option>
                                ))}
                              </select>
                              <button
                                onClick={() => applyToTC(c, idx)}
                                className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-300 text-green-700 rounded hover:bg-green-100 flex items-center gap-0.5"
                                title="Promote to Confirmed TC (local only)"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </button>
                              {savingCandidates[idx] === 'saved' ? (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center" title="Saved to library">
                                  <Check className="w-3 h-3" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSaveCandidate(c, idx)}
                                  disabled={savingCandidates[idx] === 'saving'}
                                  className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 text-gray-500 rounded hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 flex items-center gap-0.5 disabled:opacity-50"
                                  title={savingCandidates[idx] === 'error' ? 'Save failed — retry?' : 'Save to library + learn'}
                                >
                                  {savingCandidates[idx] === 'saving' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                  <span>Save</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 italic">{c.reasoning}</p>
                        </div>
                      );
                    },
                  )}
                  {(!result.tcBreakdown?.candidateResources ||
                    result.tcBreakdown.candidateResources.length === 0) && (
                    <p className="text-sm text-gray-400">
                      No candidates extracted.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-green-600">LC Breakdown</h4>
              <span className="font-mono bg-green-50 text-green-700 px-2 rounded">
                {result.lcBreakdown?.lcValue}
              </span>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <p>
                <strong>Band:</strong> {result.lcBreakdown?.lengthBand}
              </p>
              <p>
                <strong>Words:</strong> {result.lcBreakdown?.wordCount}
              </p>
              <p className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded italic">
                {result.lcBreakdown?.reasoning}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-blue-600">TL Breakdown</h4>
              <span className="font-mono bg-blue-50 text-blue-700 px-2 rounded">
                {result.tlBreakdown?.tlValue}
              </span>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <p>
                <strong>Band:</strong> {result.tlBreakdown?.band}
              </p>
              <p>
                <strong>Confidence:</strong> {result.tlBreakdown?.confidence}
              </p>
              <p className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded italic">
                {result.tlBreakdown?.reasoning}
              </p>
            </div>
          </div>
        </div>
        );
      })()}

      {activeMode === "history" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Measurement History
          </h3>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No measurement history yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-2xl font-black text-indigo-600">
                        {item.predictedCVR}
                      </span>
                      <span className="text-xs text-gray-400">
                        {item.createdAt?.seconds
                          ? new Date(
                              item.createdAt.seconds * 1000,
                            ).toLocaleString()
                          : "Just now"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 italic line-clamp-3 mb-3">
                      "{item.transcript}"
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded-lg">
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span
                        title="Estimated TC"
                        className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded"
                      >
                        TC: {item.estimatedTC}
                      </span>
                      <span
                        title="Length Complexity"
                        className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded"
                      >
                        LC: {item.lcValue}
                      </span>
                      <span
                        title="Topic Level"
                        className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
                      >
                        TL: {item.tlValue}
                      </span>
                    </div>
                    {item.matchedNames && (
                      <p className="text-[10px] text-gray-500 truncate" title={item.matchedNames}>
                        <strong>Matched:</strong> {item.matchedNames}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
