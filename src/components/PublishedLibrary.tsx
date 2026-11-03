import React, { useState, useEffect, useCallback } from 'react';
import {
  Library,
  Search,
  Copy,
  Check,
  Repeat,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  X
} from 'lucide-react';
import { db, getOperationalPublished } from '../db';
import {
  PublishedPost,
  ContentDraft,
  ContentFormat,
  EditorialCategory,
  EDITORIAL_CATEGORIES
} from '../types';
import { validateV8Caption } from '../utils/v8rules';
import { calculateEngagementRate } from '../utils/analytics';

interface PublishedLibraryProps {
  onRepurposeToDraft: (draft: ContentDraft) => void;
  demoMode?: boolean;
}

export const PublishedLibrary: React.FC<PublishedLibraryProps> = ({
  onRepurposeToDraft,
  demoMode = false
}) => {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Manual Published Post Form
  const [newTitle, setNewTitle] = useState('');
  const [newFormat, setNewFormat] = useState<ContentFormat>('Facebook Post');
  const [newCategory, setNewCategory] = useState<EditorialCategory>('Canadian Housing Market');
  const [newCaption, setNewCaption] = useState('');
  const [newHashtags, setNewHashtags] = useState('#realtyPRESS #CanadianRealEstate #CREA #REALTOR');
  const [newReach, setNewReach] = useState(0);
  const [newViews, setNewViews] = useState(0);
  const [newReactions, setNewReactions] = useState(0);
  const [newComments, setNewComments] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [newSaves, setNewSaves] = useState(0);
  const [newFollowerConversions, setNewFollowerConversions] = useState(0);

  const loadPosts = useCallback(async () => {
    const all = await getOperationalPublished(demoMode);
    setPosts(all);
  }, [demoMode]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCopy = (post: PublishedPost) => {
    navigator.clipboard.writeText(`${post.caption}\n\n${post.hashtags.join(' ')}`);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRepurpose = async (post: PublishedPost) => {
    const v8Check = validateV8Caption(post.caption, post.hashtags);
    const nowIso = new Date().toISOString();
    const newDraft: ContentDraft = {
      id: `draft-repurpose-${Date.now()}`,
      storyId: post.storyId,
      repurposedFromPostId: post.id,
      title: `[Repurposed] ${post.title}`,
      format: (post.format as ContentFormat) || 'Facebook Post',
      targetPlatform: post.platform || 'Facebook',
      headline: `[Repurposed] ${post.title}`,
      content: post.caption,
      callToAction: 'How has this trend evolved in your local market this week?',
      hashtags: post.hashtags || ['#realtyPRESS', '#CanadianRealEstate'],
      sourceAttribution: post.sourcePublication || 'realtyPRESS Archive',
      tone: 'Analytical, Authoritative & Practical',
      wordCount: v8Check.wordCount,
      audience: 'Canadian REALTORS® & Brokers',
      v8Validation: {
        isValid: v8Check.isValid,
        wordCountValid: v8Check.wordCountValid,
        paragraphCountValid: v8Check.paragraphCountValid,
        hashtagCountValid: v8Check.hashtagCountValid,
        hasBrandHashtag: v8Check.hasBrandHashtag,
        issues: v8Check.issues
      },
      status: 'Draft',
      isSampleData: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.contentDrafts.put(newDraft);
    onRepurposeToDraft(newDraft);
  };

  const handleAddPublishedPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const post: PublishedPost = {
      id: `pub-${Date.now()}`,
      title: newTitle.trim(),
      format: newFormat,
      platform: 'Facebook',
      category: newCategory,
      publishedAt: new Date().toISOString(),
      caption: newCaption.trim(),
      hashtags: newHashtags
        .split(/[\s,]+/)
        .map(h => h.trim())
        .filter(Boolean)
        .map(h => (h.startsWith('#') ? h : `#${h}`)),
      sourcePublication: 'realtyPRESS Editorial Desk',
      reach: newReach,
      views: newViews,
      reactions: newReactions,
      comments: newComments,
      shares: newShares,
      saves: newSaves,
      followerConversions: newFollowerConversions,
      dataSource: 'Manual Entry',
      isSampleData: false
    };

    await db.publishedPosts.add(post);
    setShowAddModal(false);
    setNewTitle('');
    setNewCaption('');
    await loadPosts();
  };

  const filtered = posts.filter(p => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.caption.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFmt = selectedFormat === 'All' || p.format === selectedFormat;
    return matchesSearch && matchesFmt;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              Content Archive & Repurposing Engine
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Published Content Library
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Search published realtyPRESS posts, inspect engagement metrics, and one-click repurpose top performers directly into AI Content Studio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search published archive..."
              className="pl-9 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
            />
          </div>

          <select
            value={selectedFormat}
            onChange={e => setSelectedFormat(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
          >
            <option value="All">All Formats</option>
            <option value="Facebook Post">Facebook Post</option>
            <option value="Carousel">Carousel</option>
            <option value="Reel Script">Reel Script</option>
            <option value="News Infographic Brief">News Infographic Brief</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Log Published Post
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-3">
          <Library className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-[#242626] dark:text-white">
            No Published Posts Logged Yet
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Mark a scheduled item as "Published" in the Content Calendar or click "Log Published Post" above to record a live post and track its performance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(post => {
            const engRate = calculateEngagementRate(
              post.reactions,
              post.comments,
              post.shares,
              post.reach
            );
            return (
              <div
                key={post.id}
                className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {post.isSampleData && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          DEMO SAMPLE
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 dark:bg-red-950/50 text-[#F20000]">
                        {post.format}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      Published {new Date(post.publishedAt).toLocaleDateString('en-CA')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                    {post.title}
                  </h3>

                  <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                      {post.caption}
                    </p>
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <Eye className="w-3 h-3" /> Reach
                      </div>
                      <p className="text-xs font-bold text-[#242626] dark:text-white mt-0.5">
                        {post.reach.toLocaleString()}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> Eng %
                      </div>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {engRate}%
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <Heart className="w-3 h-3" /> React
                      </div>
                      <p className="text-xs font-bold text-[#242626] dark:text-white mt-0.5">
                        {post.reactions}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <MessageCircle className="w-3 h-3" /> Comm
                      </div>
                      <p className="text-xs font-bold text-[#242626] dark:text-white mt-0.5">
                        {post.comments}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <Share2 className="w-3 h-3" /> Shares
                      </div>
                      <p className="text-xs font-bold text-[#242626] dark:text-white mt-0.5">
                        {post.shares}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <Bookmark className="w-3 h-3" /> Saves
                      </div>
                      <p className="text-xs font-bold text-[#242626] dark:text-white mt-0.5">
                        {post.saves}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +{post.followerConversions} organic followers gained
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
                    >
                      {copiedId === post.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === post.id ? 'Copied' : 'Copy Text'}
                    </button>

                    <button
                      onClick={() => handleRepurpose(post)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      Repurpose in AI Studio
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Published Post Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Log Published Post & Performance
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPublishedPost} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Post Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Format
                  </label>
                  <select
                    value={newFormat}
                    onChange={e => setNewFormat(e.target.value as ContentFormat)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    <option value="Facebook Post">Facebook Post</option>
                    <option value="Carousel">Carousel</option>
                    <option value="Reel Script">Reel Script</option>
                    <option value="News Infographic Brief">News Infographic Brief</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as EditorialCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    {EDITORIAL_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Published Caption
                </label>
                <textarea
                  rows={4}
                  value={newCaption}
                  onChange={e => setNewCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={newHashtags}
                  onChange={e => setNewHashtags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Reach</label>
                  <input
                    type="number"
                    min={0}
                    value={newReach}
                    onChange={e => setNewReach(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Views</label>
                  <input
                    type="number"
                    min={0}
                    value={newViews}
                    onChange={e => setNewViews(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">+Followers</label>
                  <input
                    type="number"
                    min={0}
                    value={newFollowerConversions}
                    onChange={e => setNewFollowerConversions(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Reactions</label>
                  <input
                    type="number"
                    min={0}
                    value={newReactions}
                    onChange={e => setNewReactions(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Comments</label>
                  <input
                    type="number"
                    min={0}
                    value={newComments}
                    onChange={e => setNewComments(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Shares</label>
                  <input
                    type="number"
                    min={0}
                    value={newShares}
                    onChange={e => setNewShares(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">Saves</label>
                  <input
                    type="number"
                    min={0}
                    value={newSaves}
                    onChange={e => setNewSaves(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#F20000] text-white text-xs font-semibold"
                >
                  Save Published Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
