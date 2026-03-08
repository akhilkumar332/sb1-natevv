import { useEffect, useMemo, useRef } from 'react';
import { sanitizeRichHtml } from '../../utils/cmsRichContent';

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

const buttonClass = 'rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';

export default function CmsRichTextEditor({ value, onChange, placeholder, disabled = false }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isFocusedRef = useRef(false);
  const htmlValue = useMemo(() => sanitizeRichHtml(value), [value]);

  useEffect(() => {
    if (!editorRef.current || isFocusedRef.current) return;
    if (editorRef.current.innerHTML !== htmlValue) {
      editorRef.current.innerHTML = htmlValue;
    }
  }, [htmlValue]);

  const emitChange = () => {
    if (!editorRef.current) return;
    onChange(sanitizeRichHtml(editorRef.current.innerHTML || ''));
  };

  const exec = (command: string, commandValue?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const addLink = () => {
    if (disabled) return;
    const href = window.prompt('Enter link URL (https:// or /path):', 'https://');
    if (!href) return;
    exec('createLink', href);
  };

  return (
    <div className="rounded-xl border border-gray-300">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2">
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('bold')}>Bold</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('italic')}>Italic</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('underline')}>Underline</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('insertUnorderedList')}>Bullets</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('insertOrderedList')}>Numbered</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('formatBlock', 'h2')}>H2</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('formatBlock', 'h3')}>H3</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={addLink}>Link</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => exec('removeFormat')}>Clear</button>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => {
          isFocusedRef.current = false;
          emitChange();
        }}
        onInput={emitChange}
        data-placeholder={placeholder || 'Start writing...'}
        className="min-h-[220px] p-3 text-sm leading-6 text-gray-800 outline-none empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_a]:text-blue-700 [&_a]:underline"
      />
    </div>
  );
}
