import { useEffect, useRef, useState } from "react";
import { pick, useI18n } from "../lib/i18n";

const EMOJI_SET = ["😀", "😂", "😍", "🤔", "👏", "🔥", "👍", "👎", "🙏", "✅", "⚡", "💡", "📌", "🧠", "❤️", "🚀"];

interface EmojiMenuProps {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
}

export const EmojiMenu = ({ disabled = false, onSelect }: EmojiMenuProps) => {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="emoji-menu" ref={rootRef}>
      <button
        type="button"
        className="emoji-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={pick(language, "Insertar emoji", "Insert emoji", "Inserir emoji")}
      >
        🙂
      </button>
      {open ? (
        <div className="emoji-popover" role="menu" aria-label={pick(language, "Emojis", "Emojis", "Emojis")}>
          <div className="emoji-grid">
            {EMOJI_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
