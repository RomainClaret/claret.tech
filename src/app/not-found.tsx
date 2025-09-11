"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* 404 Text with gradient */}
        <h1 className="text-9xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        {/* Error message */}
        <h2 className="text-3xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Oops! Looks like you&apos;ve ventured into uncharted territory. The
          page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Terminal-style message */}
        <div className="bg-card rounded-lg p-4 mb-8 font-mono text-sm text-left border border-border">
          <p className="text-green-500">$ cd /requested-page</p>
          <p className="text-red-500">
            bash: cd: /requested-page: No such file or directory
          </p>
          <p className="text-muted-foreground mt-2">
            <span className="text-primary">$</span> Try navigating back to
            safety...
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
          <Button variant="outline" onClick={handleGoBack}>
            Go Back
          </Button>
        </div>

        {/* Helpful links */}
        <div className="mt-12 text-sm text-muted-foreground">
          <p className="mb-2">Here are some helpful links:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/#skills"
              className="hover:text-primary transition-colors"
            >
              Skills
            </Link>
            <span>•</span>
            <Link
              href="/#projects"
              className="hover:text-primary transition-colors"
            >
              Projects
            </Link>
            <span>•</span>
            <Link
              href="/#research"
              className="hover:text-primary transition-colors"
            >
              Research
            </Link>
            <span>•</span>
            <Link
              href="/#contact"
              className="hover:text-primary transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
