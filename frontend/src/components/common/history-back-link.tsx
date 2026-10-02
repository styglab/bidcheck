import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type HistoryBackLinkProps = {
  fallbackTo: string;
};

export function HistoryBackLink({ fallbackTo }: HistoryBackLinkProps) {
  const navigate = useNavigate();

  return <button
    className="inline-flex h-8 items-center gap-1.5 text-sm leading-none text-muted-foreground hover:text-foreground"
    onClick={() => {
      const historyIndex = Number(window.history.state?.idx ?? 0);
      if (historyIndex > 0) navigate(-1);
      else navigate(fallbackTo);
    }}
    type="button"
  >
    <ArrowLeft size={15} /> 이전으로
  </button>;
}
