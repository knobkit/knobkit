import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Lazy-loaded render path for output({ format: "markdown" }). react-markdown escapes raw HTML by
// default, so this is XSS-safe; an html format would be a separate, deliberate opt-in.
export default function Markdown({ value }: { value: string }) {
  return (
    <div className="pu-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
