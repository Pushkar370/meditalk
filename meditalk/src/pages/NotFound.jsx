import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-ink dark:text-white flex items-center justify-center p-6 transition-colors selection:bg-primary/20">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-popover p-8 max-w-md w-full text-center animate-enter">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-ink-secondary dark:text-neutral-400 flex items-center justify-center mb-4">
          <FileQuestion className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-ink dark:text-white">
          404
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-ink-secondary dark:text-neutral-400 leading-relaxed">
          The clinical page or record you are searching for does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/">
            <Button size="lg" className="w-full shadow-card">
              Return to MediTalk Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
