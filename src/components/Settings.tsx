import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  History,
  FlaskConical,
  X
} from 'lucide-react';
import {
  db,
  getActiveSettings,
  exportDatabaseToJson,
  validateAndPreviewImport,
  executeValidatedImport,
  createAutomaticBackup,
  enableDemoMode,
  disableDemoMode,
  clearAllSampleData
} from '../db';
import { AppSettings, BackupRecord, ImportPreviewResult } from '../types';

interface SettingsProps {
  onDataReset: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onDataReset }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [aiServerStats, setAiServerStats] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import Preview Modal state (Section 8)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isExecutingImport, setIsExecutingImport] = useState(false);

  // Clear Confirmation Modal
  const [showClearProductionModal, setShowClearProductionModal] = useState(false);

  const loadSettingsAndBackups = useCallback(async () => {
    const [s, allBackups] = await Promise.all([
      getActiveSettings(),
      db.backups.orderBy('createdAt').reverse().toArray()
    ]);
    if (s) setSettings(s);
    setBackups(allBackups);

    try {
      const res = await fetch('/api/ai-config');
      if (res.ok) {
        const data = await res.json();
        setAiServerStats(data);
      }
    } catch {
      // Ignore if offline
    }
  }, []);

  useEffect(() => {
    loadSettingsAndBackups();
  }, [loadSettingsAndBackups]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await db.settings.put({ key: 'app_settings', value: settings });

    // Sync AI limits with backend server
    try {
      await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultModel: settings.aiModelPreference,
          allowPaidModels: settings.allowPaidModels,
          dailyRequestLimit: settings.dailyAiRequestLimit,
          maxOutputTokens: settings.maxOutputTokens
        })
      });
    } catch {
      // Offline safe
    }

    setStatusMessage('Settings saved to IndexedDB and synced with backend!');
    onDataReset();
    await loadSettingsAndBackups();
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleExportJSON = async () => {
    const json = await exportDatabaseToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtypress-cms-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Complete CMS JSON backup downloaded!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSelectImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    const text = await file.text();
    const preview = await validateAndPreviewImport(text);
    setImportPreview(preview);
    e.target.value = '';
  };

  const handleConfirmValidatedImport = async () => {
    if (!importPreview || !importPreview.isValid) return;
    setIsExecutingImport(true);
    setErrorMessage(null);
    try {
      const result = await executeValidatedImport(importPreview, importMode);
      if (!result.success) {
        throw new Error(result.message);
      }
      setImportPreview(null);
      setStatusMessage(result.message);
      onDataReset();
      await loadSettingsAndBackups();
    } catch (err: any) {
      setErrorMessage(
        `Transactional Restore Rolled Back: ${err.message || 'Unknown error'}. Your existing data was preserved untouched.`
      );
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleCreateManualSnapshot = async () => {
    await createAutomaticBackup('Manual User Recovery Point');
    await loadSettingsAndBackups();
    setStatusMessage('Recovery backup snapshot created in IndexedDB!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRestoreFromBackupRecord = async (backup: BackupRecord) => {
    const preview = await validateAndPreviewImport(backup.dataJson);
    setImportPreview(preview);
  };

  const handleToggleDemoMode = async (enable: boolean) => {
    if (enable) {
      await enableDemoMode();
      setStatusMessage('Demo Mode enabled. Sample records are now visible alongside a DEMO MODE banner.');
    } else {
      await disableDemoMode();
      setStatusMessage('Demo Mode disabled. Viewing clean Production Mode records only.');
    }
    onDataReset();
    await loadSettingsAndBackups();
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleClearDemoRecordsOnly = async () => {
    await clearAllSampleData();
    setStatusMessage('All Demo/Sample records deleted! Your Production records remain untouched.');
    onDataReset();
    await loadSettingsAndBackups();
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleClearAllDatabase = async () => {
    await createAutomaticBackup('Pre-Clear Emergency Backup');
    await Promise.all([
      db.stories.clear(),
      db.contentDrafts.clear(),
      db.mediaAssets.clear(),
      db.reelScripts.clear(),
      db.calendarEntries.clear(),
      db.approvals.clear(),
      db.publishedPosts.clear(),
      db.analyticsRecords.clear()
    ]);
    if (settings) {
      const updated: AppSettings = {
        ...settings,
        demoMode: false,
        currentFollowers: 0,
        initialFollowers: 0
      };
      await db.settings.put({ key: 'app_settings', value: updated });
    }
    setShowClearProductionModal(false);
    setStatusMessage('All records cleared (an emergency backup was saved in Backup History).');
    onDataReset();
    await loadSettingsAndBackups();
  };

  if (!settings) return null;

  const totalToCreate = importPreview
    ? importPreview.tableSummary.reduce((acc, r) => acc + r.toCreate, 0)
    : 0;
  const totalToUpdate = importPreview
    ? importPreview.tableSummary.reduce((acc, r) => acc + r.toUpdate, 0)
    : 0;
  const totalInvalid = importPreview
    ? importPreview.tableSummary.reduce((acc, r) => acc + r.invalidRecords, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              System Configuration, Cost Protection & Safe Data Recovery
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Studio Settings & Data Governance
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage Demo vs Production isolation, free-tier Gemini cost guardrails, and transactional JSON backup/restore.
          </p>
        </div>

        {statusMessage && (
          <div className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F20000] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Editorial, Business Profile & AI Cost Guardrails */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveSettings}
            className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-5"
          >
            <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F20000]" />
              Business Profile & Gemini Zero-Cost Guardrails
            </h3>

            {/* Consumer vs API Billing Warning */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-bold">Important Distinction: Google AI Pro vs Gemini API Billing</p>
              <p className="text-[11px] leading-relaxed">
                A consumer Google AI Pro subscription does not provide paid Gemini API credits. To guarantee $0 cost, this studio locks to free-tier eligible models (`gemini-3.8-flash`), disables `gemini-4-argon` by default, and never auto-upgrades to paid billing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Brand Publication Name
                </label>
                <input
                  type="text"
                  value={settings.brandName}
                  onChange={e => setSettings({ ...settings, brandName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Gemini Model
                </label>
                <select
                  value={settings.aiModelPreference}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      aiModelPreference: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended Free-Tier)</option>
                  {settings.allowPaidModels && (
                    <option value="gemini-4-argon">gemini-4-argon (Paid Tier Only)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Daily Free-Tier Request Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.dailyAiRequestLimit}
                  onChange={e =>
                    setSettings({ ...settings, dailyAiRequestLimit: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Max Output Tokens
                </label>
                <input
                  type="number"
                  min={256}
                  max={8192}
                  value={settings.maxOutputTokens}
                  onChange={e =>
                    setSettings({ ...settings, maxOutputTokens: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Initial Follower Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.initialFollowers}
                  onChange={e =>
                    setSettings({ ...settings, initialFollowers: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Current Followers
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.currentFollowers}
                  onChange={e =>
                    setSettings({ ...settings, currentFollowers: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  90-Day Target Followers
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.followerTarget90Day}
                  onChange={e =>
                    setSettings({ ...settings, followerTarget90Day: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Achievement Date
                </label>
                <input
                  type="date"
                  value={settings.targetAchievementDate || '2027-01-31'}
                  onChange={e =>
                    setSettings({ ...settings, targetAchievementDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reporting Period Label
                </label>
                <input
                  type="text"
                  value={settings.reportingPeriod || '90-Day Organic Growth Sprint'}
                  onChange={e => setSettings({ ...settings, reportingPeriod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </form>

          {/* Demo Mode & Sample Data Isolation Card (Section 2) */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                  Demo Mode & Sample Data Isolation
                </h3>
              </div>
              <span
                className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                  settings.demoMode
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {settings.demoMode ? 'DEMO MODE ACTIVE' : 'PRODUCTION MODE (CLEAN)'}
              </span>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Demo records (`isSampleData: true`) are strictly separated from your real production records. Disabling Demo Mode hides all sample records immediately, and deleting demo records will never delete your real stories, drafts, or analytics.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              {!settings.demoMode ? (
                <button
                  type="button"
                  onClick={() => handleToggleDemoMode(true)}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                >
                  Enable Demo Mode (Load Sample Data)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleDemoMode(false)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Disable Demo Mode (Switch to Production)
                </button>
              )}

              <button
                type="button"
                onClick={handleClearDemoRecordsOnly}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
              >
                Clear Demo Data Only (Preserve Production)
              </button>
            </div>
          </div>
        </div>

        {/* Right: Safe Backup, Validated Import & AI Telemetry */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#F20000]" />
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Safe Database Backup & Transactional Restore
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Imports are validated for schema integrity before any table is modified. You will see a full preview of records to create or update, and an automatic recovery point is created before import.
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Export Complete CMS Database (.json)
              </button>

              <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[#F20000]" />
                Validate & Preview JSON Backup Restore
                <input
                  type="file"
                  accept=".json"
                  onChange={handleSelectImportFile}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleCreateManualSnapshot}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Create Instant Local Recovery Snapshot
              </button>
            </div>

            {/* Backup History */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <p className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Local Recovery Snapshots ({backups.length})
              </p>
              {backups.length === 0 ? (
                <p className="text-[11px] text-gray-400">
                  No local snapshots yet. Snapshots are created automatically before any JSON import.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {backups.map(b => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#242626] dark:text-white">{b.label}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(b.createdAt).toLocaleString('en-CA')} • {b.recordCounts?.stories || 0}{' '}
                          stories, {b.recordCounts?.contentDrafts || 0} drafts
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreFromBackupRecord(b)}
                        className="px-2.5 py-1 rounded bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-[11px] font-semibold shrink-0"
                      >
                        Preview Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowClearProductionModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset All Workspace Tables
              </button>
            </div>
          </div>

          {/* Live AI Guardrail Telemetry */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-sm font-bold font-['Poppins']">
                Backend AI Cost Protection & Usage Log
              </h3>
            </div>
            {aiServerStats ? (
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Server Active Model:</span>
                  <strong className="text-[#242626] dark:text-white">
                    {aiServerStats.config?.defaultModel || 'gemini-3.8-flash'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Daily Requests Used:</span>
                  <strong className="text-[#242626] dark:text-white">
                    {aiServerStats.usageToday || 0} / {aiServerStats.config?.dailyRequestLimit || 50}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Paid Models Blocked:</span>
                  <strong className="text-emerald-600">
                    {!aiServerStats.config?.allowPaidModels ? 'Yes ($0 Protected)' : 'No'}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Backend AI usage telemetry ready.</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 8: Import Validation & Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Database Import Validation & Preview
              </h3>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!importPreview.isValid ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2 text-xs text-red-700 dark:text-red-300">
                <p className="font-bold">Import Blocked — Invalid Backup File</p>
                <p>Your existing database was NOT modified.</p>
                <ul className="list-disc list-inside space-y-1">
                  {importPreview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold">
                  Schema v{importPreview.schemaVersion} Validated. Ready for transactional restore.
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">To Create</p>
                    <p className="text-base font-bold text-emerald-600">{totalToCreate}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">To Update</p>
                    <p className="text-base font-bold text-blue-600">{totalToUpdate}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">Skipped/Invalid</p>
                    <p className="text-base font-bold text-amber-600">{totalInvalid}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Restore Mode:
                  </label>
                  <select
                    value={importMode}
                    onChange={e => setImportMode(e.target.value as 'merge' | 'replace')}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    <option value="merge">Merge with Existing Records</option>
                    <option value="replace">Replace Workspace Tables</option>
                  </select>
                </div>

                <p className="text-[11px] text-gray-500">
                  An automatic recovery backup of your current workspace will be saved to Backup History before this import runs.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                Cancel
              </button>
              {importPreview.isValid && (
                <button
                  onClick={handleConfirmValidatedImport}
                  disabled={isExecutingImport}
                  className="px-5 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
                >
                  {isExecutingImport ? 'Restoring...' : 'Confirm & Execute Transactional Restore'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearProductionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#242626] dark:text-white">
              Confirm Workspace Reset
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              This will clear all stories, drafts, calendar events, and analytics from the active workspace. An automatic emergency recovery snapshot will be created first so you can undo if needed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearProductionModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllDatabase}
                className="px-4 py-2 rounded-lg bg-[#F20000] text-white text-xs font-semibold"
              >
                Create Backup & Reset Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
