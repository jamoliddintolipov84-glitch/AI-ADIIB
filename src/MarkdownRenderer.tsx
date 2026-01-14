
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple regex-based formatter for demonstration. 
  // In a real app, use a library like react-markdown.
  const formatText = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2 text-emerald-900">{line.replace('### ', '')}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-6 mb-3 text-emerald-900 border-b pb-1">{line.replace('## ', '')}</h2>;
        
        // Lists
        if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 list-disc text-gray-700 mb-1">{line.trim().replace('- ', '')}</li>;
        if (line.trim().match(/^\d+\./)) return <li key={i} className="ml-4 list-decimal text-gray-700 mb-1">{line.trim().replace(/^\d+\.\s*/, '')}</li>;

        // Bold
        const boldParts = line.split(/(\*\*.*?\*\*)/);
        const formattedLine = boldParts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-bold text-emerald-800">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        return <p key={i} className="mb-2 text-gray-800 leading-relaxed">{formattedLine}</p>;
      });
  };

  return <div className="markdown-body">{formatText(content)}</div>;
};

export default MarkdownRenderer;
