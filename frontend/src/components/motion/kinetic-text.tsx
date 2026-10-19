/** React owns the word wrappers, so updates and screen-reader names stay intact. */
export function KineticText({ text, className = "" }: { text: string; className?: string }) {
  return <span className={className}><span className="sr-only">{text}</span><span aria-hidden="true">{text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <span className="kinetic-word-mask" key={`${index}-${word}`}><span data-kinetic-word className="kinetic-word">{word}</span></span>)}</span></span>;
}
