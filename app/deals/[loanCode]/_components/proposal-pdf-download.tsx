"use client";

import { useState, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import { ProposalPDF } from "./proposal-pdf";
import { ProposalData } from "@/lib/proposal-pdf-types";
import { Button } from "@/components/ui/button";

interface ProposalPDFDownloadProps {
  data: ProposalData;
  loanCode: string;
}

export function ProposalPDFDownload({
  data,
  loanCode,
}: ProposalPDFDownloadProps) {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load logo as base64 on mount
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch("/BP_Logo.png");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
          setIsLoading(false);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Failed to load logo:", error);
        setIsLoading(false);
      }
    };
    loadLogo();
  }, []);

  const handleDownload = async () => {
    if (!logoBase64) return;

    setIsGenerating(true);
    try {
      const blob = await pdf(
        <ProposalPDF data={data} logoBase64={logoBase64} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Proposal-${loanCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const isPdfReady = !isLoading && logoBase64;

  return (
    <Button onClick={handleDownload} disabled={!isPdfReady || isGenerating}>
      {isLoading || isGenerating ? (
        <>
          <svg
            className="animate-spin h-5 w-5 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {isGenerating ? "Generating..." : "Loading..."}
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download PDF
        </>
      )}
    </Button>
  );
}
