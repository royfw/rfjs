import { Button } from "@rfjs/web-ui/components/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-mono text-3xl font-bold">rfjs</h1>
      <p className="text-sm">
        RoyFW&apos;s TypeScript utility toolkit — site under construction.
      </p>
      <Button variant="outline">It works</Button>
    </main>
  );
}
