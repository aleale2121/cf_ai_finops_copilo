import type { Tokens } from "marked";
import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens: TokensList = marked.lexer(markdown);
  return tokens.map((token: Tokens.Generic) => token.raw);
}

type TokensList = Array<Tokens.Generic & { raw: string }>;

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <div className="markdown-body w-full max-w-full overflow-hidden break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Override code blocks to ensure they wrap
          code: (props) => {
            const { className, children, ...rest } = props;
            const isInline = !className?.includes("language-");
            return (
              <code
                className={`${className || ""} break-words ${isInline ? "" : "whitespace-pre-wrap block"}`}
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (props) => {
            const { children, ...rest } = props;
            return (
              <pre
                className="whitespace-pre-wrap break-words max-w-full overflow-x-hidden"
                {...rest}
              >
                {children}
              </pre>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
    return blocks.map((block, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
