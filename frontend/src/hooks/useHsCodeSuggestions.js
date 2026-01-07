import { useState, useEffect, useRef } from 'react';

export function useHsCodeSuggestions({ name, category, description, delay = 700, k = 5 } = {}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const lastQuery = useRef('');
  const timer = useRef(null);

  useEffect(() => {
    const q = `${name || ''} ${category || ''} ${description || ''}`.trim();
    if (!q || q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (q === lastQuery.current) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      lastQuery.current = q;
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch('https://api.pre-clear.app/api/ai/hs/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category, description, k })
        });
        if (!resp.ok) throw new Error('API error: ' + resp.status);
        const body = await resp.json();
        const suggestions = body?.suggestions;
        if (!Array.isArray(suggestions)) {
          console.warn('Invalid HS suggestions response:', body);
          setSuggestions([]);
          return;
        }
        const items = suggestions.map(s => ({ code: s.hscode || s.code, description: s.description || '', score: s.score || 0 }));
        setSuggestions(items);
      } catch (err) {
        setError(err.message || 'error');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer.current);
  }, [name, category, description, delay, k]);

  return { loading, suggestions, error };
}
