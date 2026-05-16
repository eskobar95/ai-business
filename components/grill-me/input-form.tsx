"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUp, Paperclip, X, FileText, File } from "lucide-react";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import type { GrillQuickReply } from "@/lib/grill-me/extract-quick-replies";
import { cn } from "@/lib/utils";

export type AttachedFile = {
  id: string;
  file: File;
  name: string;
  type: "image" | "pdf" | "docx" | "other";
  previewUrl: string | null;
};

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_MB = 20;

function classifyFile(file: File): AttachedFile["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("wordprocessingml")) return "docx";
  return "other";
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

async function buildAttachedFile(file: File): Promise<AttachedFile | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) return null;
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return null;

  const type = classifyFile(file);
  let previewUrl: string | null = null;
  if (type === "image") {
    previewUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }
  return { id: makeId(), file, name: file.name, type, previewUrl };
}

export function InputForm({
  disabled,
  onSend,
  embedded = false,
  quickReplies = [],
  placeholder = embedded ? "Reply…" : "Describe your business…",
}: {
  disabled: boolean;
  onSend: (text: string, attachments?: AttachedFile[]) => void;
  embedded?: boolean;
  quickReplies?: GrillQuickReply[];
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = value.trim();
    if ((!t && attachments.length === 0) || disabled) return;
    setValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(t, attachments.length > 0 ? attachments : undefined);
  }

  function pickReply(r: GrillQuickReply) {
    if (disabled) return;
    onSend(r.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const built = await Promise.all(incoming.map(buildAttachedFile));
    const valid = built.filter(Boolean) as AttachedFile[];
    setAttachments((prev) => [...prev, ...valid]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void addFiles(e.target.files);
    e.target.value = "";
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean) as File[];
      void addFiles(files);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
    },
    [],
  );

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  if (embedded) {
    return (
      <div
        className={cn(
          "shrink-0 border-t border-white/[0.06] transition-colors",
          dragOver && "border-primary/40 bg-primary/[0.03]",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Quick reply chips */}
        {quickReplies.length > 0 && (
          <Suggestions
            className="gap-1.5 px-3 pt-3 pb-0"
            role="group"
            aria-label="Quick replies"
          >
            {quickReplies.map((r) => (
              <Suggestion
                key={r.id}
                suggestion={r.label}
                disabled={disabled}
                className="max-w-[260px] truncate border-white/[0.1] bg-white/[0.04] text-[11px] text-foreground/70 hover:border-primary/40 hover:bg-primary/[0.07]"
                onClick={() => pickReply(r)}
              />
            ))}
            <Suggestion
              suggestion="Other — write below"
              disabled={disabled}
              variant="ghost"
              className="border border-dashed border-white/[0.08] text-muted-foreground/40"
              onClick={() => textareaRef.current?.focus()}
            />
          </Suggestions>
        )}

        {/* Attachment thumbnails */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2.5">
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-3">
          {/* File picker button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 size-9 rounded-xl flex items-center justify-center transition-all bg-white/[0.04] border border-white/[0.07] text-muted-foreground/40 hover:text-muted-foreground/70 hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Attach file"
          >
            <Paperclip className="size-3.5" strokeWidth={2} />
          </button>

          <textarea
            ref={textareaRef}
            id="grill-me-chat-input-inline"
            data-testid="grill-me-chat-input"
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            className={cn(
              "flex-1 resize-none rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none transition-all",
              "focus:border-primary/35 focus:bg-white/[0.06]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "min-h-[40px] leading-relaxed",
            )}
            style={{ height: "40px" }}
          />
          <button
            type="button"
            data-testid="grill-me-send"
            disabled={!canSend}
            onClick={() => submit()}
            className={cn(
              "shrink-0 size-9 rounded-xl flex items-center justify-center transition-all",
              canSend
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90 cursor-pointer"
                : "bg-white/[0.06] text-muted-foreground/30 cursor-not-allowed",
            )}
            aria-label="Send"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={handleFileInput}
          aria-hidden
        />
      </div>
    );
  }

  // Standalone (dashboard Grill-Me page)
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
          {quickReplies.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => pickReply(r)}
              className="border-border hover:border-primary/50 hover:bg-primary/10 rounded-full border px-3 py-1.5 text-left font-mono text-[11px] leading-snug transition-colors disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => textareaRef.current?.focus()}
            className="text-muted-foreground hover:border-primary/40 hover:text-foreground border-border rounded-full border border-dashed px-3 py-1.5 text-[11px] transition-colors disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          >
            Other — type below
          </button>
        </div>
      ) : null}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative rounded-xl border transition-colors",
          dragOver ? "border-primary/40 bg-primary/[0.03]" : "border-border",
        )}
      >
        <textarea
          ref={textareaRef}
          data-testid="grill-me-chat-input"
          className="bg-background text-foreground placeholder:text-muted-foreground focus:outline-none w-full rounded-xl px-4 py-3 pr-20 text-sm shadow-sm resize-none min-h-[88px]"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Attach file"
          >
            <Paperclip className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="submit"
            data-testid="grill-me-send"
            disabled={!canSend}
            className={cn(
              "size-8 rounded-lg flex items-center justify-center transition-all",
              canSend
                ? "bg-foreground text-background hover:opacity-80 cursor-pointer"
                : "bg-muted text-muted-foreground/30 cursor-not-allowed",
            )}
            aria-label="Send"
          >
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-hidden
      />
    </form>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: AttachedFile;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] pr-7 overflow-hidden max-w-[160px]">
      {attachment.type === "image" && attachment.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="size-9 shrink-0 object-cover"
        />
      ) : (
        <div className="size-9 shrink-0 flex items-center justify-center bg-white/[0.04]">
          {attachment.type === "pdf" ? (
            <FileText className="size-4 text-red-400/70" strokeWidth={1.5} />
          ) : attachment.type === "docx" ? (
            <FileText className="size-4 text-blue-400/70" strokeWidth={1.5} />
          ) : (
            <File className="size-4 text-muted-foreground/50" strokeWidth={1.5} />
          )}
        </div>
      )}
      <span className="text-[10px] text-foreground/60 truncate leading-none py-1">
        {attachment.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 rounded-full bg-white/[0.08] flex items-center justify-center hover:bg-white/[0.15] transition-colors cursor-pointer"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="size-2.5 text-foreground/50" strokeWidth={2.5} />
      </button>
    </div>
  );
}
