import { dreamRecorder } from '@/utils/dream-recorder';
export default function DreamRecorderCredit() {
  return (
    <p className="my-5 text-sm text-text-muted">
      Preserved with edition data from{' '}
      <a
        href={dreamRecorder.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline"
      >
        The Guild Archive ↗
      </a>
      .
    </p>
  );
}
