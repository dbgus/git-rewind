import { useState, useEffect } from "react";
import {
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  fetchTagStats,
} from "./api";

interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface TagStats {
  tag_id: number;
  tag_name: string;
  color: string;
  count: number;
}

export default function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#58a6ff",
    description: "",
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const [tagsData, statsData] = await Promise.all([
        fetchTags(),
        fetchTagStats(),
      ]);
      setTags(tagsData);
      setTagStats(statsData);
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTag(formData.name, formData.color, formData.description);
      setFormData({ name: "", color: "#58a6ff", description: "" });
      setShowCreateForm(false);
      loadTags();
    } catch (error) {
      console.error("Failed to create tag:", error);
      alert("태그 생성 실패");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    try {
      await updateTag(
        editingTag.id,
        formData.name,
        formData.color,
        formData.description
      );
      setEditingTag(null);
      setFormData({ name: "", color: "#58a6ff", description: "" });
      loadTags();
    } catch (error) {
      console.error("Failed to update tag:", error);
      alert("태그 수정 실패");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 태그를 삭제하시겠습니까?")) return;
    try {
      await deleteTag(id);
      loadTags();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("태그 삭제 실패");
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || "",
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setShowCreateForm(false);
    setFormData({ name: "", color: "#58a6ff", description: "" });
  };

  const getTagCount = (tagId: number) => {
    return tagStats.find((s) => s.tag_id === tagId)?.count || 0;
  };

  if (loading) {
    return <div className="p-6 text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">태그 관리</h2>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingTag(null);
            setFormData({ name: "", color: "#58a6ff", description: "" });
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          새 태그 추가
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTag) && (
        <form
          onSubmit={editingTag ? handleUpdate : handleCreate}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingTag ? "태그 수정" : "새 태그 추가"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                태그 이름
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: feature"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                색상
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                설명 (선택)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 새로운 기능 추가"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {editingTag ? "수정" : "생성"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* Tags List */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                태그
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                색상
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                설명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                커밋 수
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {tags.map((tag) => (
              <tr key={tag.id} className="hover:bg-gray-750">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-gray-600"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-gray-400 font-mono">
                      {tag.color}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {tag.description || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {getTagCount(tag.id)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => startEdit(tag)}
                    className="text-blue-400 hover:text-blue-300 mr-4"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tags.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          태그가 없습니다. 새 태그를 추가해보세요.
        </div>
      )}
    </div>
  );
}
