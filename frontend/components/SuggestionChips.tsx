import React from 'react';

interface Suggestion {
  short_text: string;
  prompt_text: string;
}

interface SuggestionChipsProps {
  suggestions: Suggestion[];
  onSuggestionClick: (prompt: string) => void;
}

const SuggestionChips: React.FC<SuggestionChipsProps> = ({ suggestions, onSuggestionClick }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex space-x-2 p-2 overflow-x-auto">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSuggestionClick(suggestion.prompt_text)}
          className="bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 font-medium py-1 px-3 border border-gray-300 rounded-lg shadow-sm transition-colors duration-150 ease-in-out whitespace-nowrap"
        >
          {suggestion.short_text}
        </button>
      ))}
    </div>
  );
};

export default SuggestionChips;
