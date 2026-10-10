import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Trash2, Copy, Check, CheckSquare, X, Search, Tag, Eye } from 'lucide-react';
import { uid, newTask, type Store, type Idea } from '../model';
import { localDate } from '../scheduler';

interface IdeasViewProps {
  store: Store;
  change: (fn: (s: Store) => Store) => void;
  onNotify?: (msg: string) => void;
}

// 纯前端图片压缩：等比缩放到最大 1000px，JPEG 0.8 质量，单张通常仅 50~90KB
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${time}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

export function IdeasView({ store, change, onNotify }: IdeasViewProps) {
  const [content, setContent] = useState('');
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => onNotify?.(msg);

  // 处理文件上传
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressing(true);
    try {
      const newImgs: string[] = [];
      for (let i = 0; i < Math.min(files.length, 4); i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const compressed = await compressImage(file);
          newImgs.push(compressed);
        }
      }
      setDraftImages((prev) => [...prev, ...newImgs].slice(0, 4));
    } catch {
      notify('图片压缩失败');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 支持粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFiles([file] as unknown as FileList);
          break;
        }
      }
    }
  };

  // 快捷插入标签
  const addTagToContent = (tag: string) => {
    if (!content.includes(tag)) {
      setContent((prev) => (prev ? prev + ' ' + tag : tag + ' '));
    }
  };

  // 提交发布
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text && draftImages.length === 0) {
      notify('请输入点子内容或上传图片');
      return;
    }

    // 提取 #标签
    const tags = Array.from(text.matchAll(/#([^\s#]+)/g), (m) => m[1]);
    const idea: Idea = {
      id: uid(),
      content: text,
      tags,
      images: draftImages.length > 0 ? draftImages : undefined,
      created: Date.now(),
    };

    change((s) => ({
      ...s,
      ideas: [idea, ...(s.ideas || [])],
    }));

    setContent('');
    setDraftImages([]);
    notify('灵感已记下！');
  };

  // 复制灵感内容
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    notify('内容已复制到剪贴板');
  };

  // 转为待办任务
  const handleConvertToTask = (idea: Idea) => {
    const lines = idea.content.split('\n').filter((l) => l.trim());
    const title = lines[0]?.replace(/#([^\s#]+)/g, '').trim() || '灵感任务';
    const notes = lines.slice(1).join('\n') || '';
    const task = {
      ...newTask(title, localDate(), 'inbox'),
      notes,
      tags: idea.tags,
    };
    change((s) => ({
      ...s,
      tasks: [task, ...s.tasks],
    }));
    notify('已成功在收集箱生成待办任务！');
  };

  // 删除灵感
  const handleDelete = (id: string) => {
    change((s) => ({
      ...s,
      ideas: (s.ideas || []).filter((i) => i.id !== id),
    }));
    notify('灵感已删除');
  };

  // 提取所有已存在的标签用于快速筛选
  const allTags = Array.from(
    new Set((store.ideas || []).flatMap((i) => i.tags || []))
  );

  // 筛选过滤
  const filteredIdeas = (store.ideas || []).filter((idea) => {
    if (filterTag !== 'all' && !idea.tags.includes(filterTag)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        idea.content.toLowerCase().includes(q) ||
        idea.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <section className="ideas-view">
      <header className="ideas-header">
        <div>
          <h2>灵感与随手记</h2>
          <p>随时记下点子、梗、随口一句话、日记与照片，多端实时同步。</p>
        </div>
      </header>

      {/* 发布区 */}
      <form onSubmit={handlePublish} className="idea-composer">
        <textarea
          placeholder="记录此时此刻的想法、点子、金句、梗或日记... (支持直接 Ctrl+V 粘贴截图)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          rows={3}
        />

        {draftImages.length > 0 && (
          <div className="draft-images-preview">
            {draftImages.map((img, idx) => (
              <div key={idx} className="draft-img-item">
                <img src={img} alt="预览" />
                <button
                  type="button"
                  className="draft-img-remove"
                  onClick={() => setDraftImages(draftImages.filter((_, i) => i !== idx))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-toolbar">
          <div className="quick-tags">
            {['#点子', '#梗', '#一句话', '#日记'].map((tag) => (
              <button
                type="button"
                key={tag}
                className="chip-btn"
                onClick={() => addTagToContent(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="composer-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="soft-button"
              disabled={compressing || draftImages.length >= 4}
              onClick={() => fileInputRef.current?.click()}
              title="添加图片 (自动高清微压缩)"
            >
              <ImageIcon size={15} />
              <span>{compressing ? '压缩中...' : '添加图片'}</span>
            </button>

            <button type="submit" className="primary" disabled={compressing}>
              <Sparkles size={15} />
              <span>记下灵感</span>
            </button>
          </div>
        </div>
      </form>

      {/* 搜索与筛选 */}
      <div className="ideas-filter-bar">
        <div className="search-filter">
          <Search size={14} />
          <input
            placeholder="搜索灵感内容或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tag-filters">
          <button
            className={filterTag === 'all' ? 'active' : ''}
            onClick={() => setFilterTag('all')}
          >
            全部 ({store.ideas?.length || 0})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={filterTag === tag ? 'active' : ''}
              onClick={() => setFilterTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* 灵感卡片列表 */}
      <div className="ideas-grid">
        {filteredIdeas.length === 0 ? (
          <div className="ideas-empty">
            <Sparkles size={48} strokeWidth={1} />
            <p>还没有记录灵感</p>
            <small>脑海里闪过的好点子、好笑的梗，随时写下来！</small>
          </div>
        ) : (
          filteredIdeas.map((idea) => (
            <article key={idea.id} className="idea-card">
              <header className="idea-card-header">
                <span className="idea-time">{formatDate(idea.created)}</span>
                <div className="idea-tags">
                  {idea.tags.map((t) => (
                    <span key={t} className="idea-tag-pill">
                      #{t}
                    </span>
                  ))}
                </div>
              </header>

              {idea.content && (
                <div className="idea-card-content">{idea.content}</div>
              )}

              {idea.images && idea.images.length > 0 && (
                <div className={'idea-card-images count-' + idea.images.length}>
                  {idea.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="idea-img-thumb"
                      onClick={() => setLightboxImg(img)}
                    >
                      <img src={img} alt="图片" loading="lazy" />
                      <span className="img-zoom-hint">
                        <Eye size={12} />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <footer className="idea-card-footer">
                <button
                  className="icon-text-btn"
                  title="复制文字"
                  onClick={() => handleCopy(idea.id, idea.content)}
                >
                  {copiedId === idea.id ? (
                    <>
                      <Check size={14} color="#51a98b" />
                      <span style={{ color: '#51a98b' }}>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>复制</span>
                    </>
                  )}
                </button>

                <button
                  className="icon-text-btn"
                  title="将此灵感转为待办任务"
                  onClick={() => handleConvertToTask(idea)}
                >
                  <CheckSquare size={14} />
                  <span>转为待办</span>
                </button>

                <button
                  className="icon-text-btn danger"
                  title="删除"
                  onClick={() => handleDelete(idea.id)}
                >
                  <Trash2 size={14} />
                </button>
              </footer>
            </article>
          ))
        )}
      </div>

      {/* 图片全屏预览弹窗 */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <button
            className="lightbox-close"
            onClick={() => setLightboxImg(null)}
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImg}
            alt="大图预览"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
