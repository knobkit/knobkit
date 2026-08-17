import { puMd } from "./markdown.css.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown escapes raw HTML by default, so this is XSS-safe
export default function Markdown({ value }: { value: string }) {
  return (
    <div className={puMd}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
