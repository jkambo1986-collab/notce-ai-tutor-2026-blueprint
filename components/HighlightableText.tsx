/**
 * @file HighlightableText.tsx
 * @description A text rendering component that supports user-interactive highlighting.
 * Allows students to select text within the clinical vignette to mark key indicators.
 * Also supports displaying AI-identified expert highlights for the Evidence-Link feature.
 */

import React from 'react';
import { Highlight, ExpertHighlight } from '../types';

/**
 * Props for HighlightableText component.
 */
interface Props {
  /** The full text content of the vignette to display. */
  text: string;
  /** Array of current user highlights (yellow). */
  highlights: Highlight[];
  /** Array of AI-identified expert highlights (indigo) - shown after submission. */
  expertHighlights?: ExpertHighlight[];
  /** Callback fired when a user completes a text selection. */
  onAddHighlight: (highlight: Highlight) => void;
  /** Callback fired when a user clicks an existing highlight to remove it. */
  onRemoveHighlight: (id: string) => void;
  /** If true, disable adding new highlights (read-only mode for review). */
  readOnly?: boolean;
}

/** Combined highlight type for rendering */
interface RenderHighlight {
  start: number;
  end: number;
  type: 'user' | 'expert';
  id?: string;
  importance?: 'critical' | 'supporting';
}

/**
 * HighlightableText Component
 * 
 * Handles the logic for detecting text selections, calculating character offsets,
 * and rendering a mixed stream of plain text and highlighted spans.
 * 
 * @param {Props} props - Component props
 * @returns {JSX.Element} The rendered text container
 */
const HighlightableText: React.FC<Props> = ({ 
  text, 
  highlights, 
  expertHighlights = [], 
  onAddHighlight, 
  onRemoveHighlight,
  readOnly = false 
}) => {
  
  /**
   * Event handler for mouse/selection events.
   * Calculates the start and end offsets of the selected text relative to the container.
   */
  const handleMouseUp = () => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    // Ignore empty selections or clicks without range
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') return;

    const range = selection.getRangeAt(0);
    
    // Create a clone range to measure the offset from the start of the container
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(document.getElementById('vignette-container')!);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    const start = preSelectionRange.toString().length;
    const selectedText = selection.toString();
    const end = start + selectedText.length;

    const newHighlight: Highlight = {
      id: Math.random().toString(36).substr(2, 9), // Generate simple unique ID
      start,
      end,
      text: selectedText,
    };

    onAddHighlight(newHighlight);
    selection.removeAllRanges(); // Clear browser visual selection after capturing
  };

  /**
   * Renders the text content, interleaving plain text with highlighted spans.
   * Handles both user (yellow) and expert (indigo) highlights.
   * 
   * @returns {React.ReactNode[]} Array of text nodes and span elements
   */
  const renderText = () => {
    // Combine user and expert highlights into a single array with type markers
    const allHighlights: RenderHighlight[] = [
      ...highlights.map(h => ({ start: h.start, end: h.end, type: 'user' as const, id: h.id })),
      ...expertHighlights.map(h => ({ start: h.start, end: h.end, type: 'expert' as const, importance: h.importance }))
    ];
    
    // Sort highlights by start position
    const sorted = allHighlights.sort((a, b) => a.start - b.start);
    
    let result: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((h, idx) => {
      // Skip if this highlight overlaps with already rendered content
      if (h.start < lastIndex) return;
      
      // Add plain text before highlight
      if (h.start > lastIndex) {
        result.push(text.slice(lastIndex, h.start));
      }
      
      // Determine styling based on highlight type
      const isExpert = h.type === 'expert';
      const isCritical = isExpert && h.importance === 'critical';
      
      const className = isExpert 
        ? `expert-highlight ${isCritical ? 'critical' : ''}`
        : 'vignette-highlight';
      
      // Add highlight span
      result.push(
        <span
          key={h.id || `expert-${idx}`}
          className={className}
          onClick={(e) => {
            if (!isExpert && h.id) {
              e.stopPropagation();
              onRemoveHighlight(h.id);
            }
          }}
          title={isExpert 
            ? `Expert Indicator ${isCritical ? '(Critical)' : '(Supporting)'}` 
            : 'Click to remove highlight'}
        >
          {text.slice(h.start, h.end)}
        </span>
      );
      lastIndex = h.end;
    });

    // Add remaining text after the last highlight
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  return (
    <div 
      id="vignette-container"
      onMouseUp={handleMouseUp}
      // 'whitespace-pre-wrap' preserves formatting, 'select-text' enables selection
      className={`prose prose-slate max-w-none leading-relaxed select-text text-gray-700 text-lg whitespace-pre-wrap ${readOnly ? 'cursor-default' : ''}`}
    >
      {renderText()}
    </div>
  );
};

export default HighlightableText;
