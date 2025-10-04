import { useState, useEffect } from "react";
import {
  fetchTags,
  fetchCommitTags,
  addTagToCommit,
  removeTagFromCommit,
} from "./api";

interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

interface CommitTagsProps {
  commitSha: string;
}

export default function CommitTags({ commitSha }: CommitTagsProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [commitTags, setCommitTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, [commitSha]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const [all, commit] = await Promise.all([
        fetchTags(),
        fetchCommitTags(commitSha),
      ]);
      setAllTags(all);
      setCommitTags(commit);
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updatedTags = await addTagToCommit(commitSha, tag.id);
      setCommitTags(updatedTags);
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updatedTags = await removeTagFromCommit(commitSha, tag.id);
      setCommitTags(updatedTags);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const availableTags = allTags.filter(
    (tag) => !commitTags.find((ct) => ct.id === tag.id)
  );

  if (loading) return null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {commitTags.map((tag) => (
        <button
          key={tag.id}
          onClick={(e) => handleRemoveTag(tag, e)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
          title={`${tag.description || tag.name} (Click to remove)`}
        >
          {tag.name}
          <span className="text-xs">×</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors"
        >
          + Tag
        </button>

        {showDropdown && availableTags.length > 0 && (
          <div className="absolute z-10 mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg min-w-[150px]">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={(e) => {
                  handleAddTag(tag, e);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
              >
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
                {tag.description && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {tag.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
