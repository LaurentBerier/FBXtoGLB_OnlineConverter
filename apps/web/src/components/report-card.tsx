'use client';

import { Check, AlertTriangle, X, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConversionReport, ReportCheck } from '@/lib/api';

function StatusIcon({ status }: { status: ReportCheck['status'] }) {
  if (status === 'ok') return <Check className="h-4 w-4 text-success" />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <X className="h-4 w-4 text-destructive" />;
}

function VerdictBadge({ verdict }: { verdict: ConversionReport['verdict'] }) {
  if (verdict === 'pass') return <Badge variant="success">All checks passed</Badge>;
  if (verdict === 'pass-with-warnings') return <Badge variant="warn">Passed with warnings</Badge>;
  return <Badge variant="destructive">Validation failed</Badge>;
}

export function ReportCard({ report }: { report: ConversionReport }) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Conversion report
        </CardTitle>
        <VerdictBadge verdict={report.verdict} />
      </CardHeader>
      <CardContent className="space-y-1">
        {report.checks.map((c) => (
          <div
            key={c.key}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted/60"
          >
            <span className="flex items-center gap-2.5">
              <StatusIcon status={c.status} />
              <span className="font-medium">{c.label}</span>
            </span>
            <span className="text-muted-foreground">{c.detail}</span>
          </div>
        ))}

        {report.notes.length > 0 && (
          <details className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">
              Details ({report.notes.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {report.notes.map((n, i) => (
                <li key={i} className="leading-relaxed">
                  • {n}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
