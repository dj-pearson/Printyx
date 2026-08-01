/**
 * Predictive Analytics — preview placeholder (PROD-010).
 *
 * This page previously issued three polling queries against
 * /api/predictive-analytics/{dashboard,models,data-sources} and rendered ~965
 * lines of dashboard UI from the responses.
 *
 * None of those endpoints exist. There is no handler in Express and no edge
 * function, so the page was broken in DEV as well as production — not a
 * prod-only 404 like the rest of the PROD-010 batch. More fundamentally there is
 * nothing to serve: no ml_models, training_jobs, model_performance,
 * data_sources, predictive_insights or prediction_models table exists in any
 * schema or migration. The UI was built against an imagined API with no backing
 * store anywhere in the system.
 *
 * So `analyticsData` was always undefined, the dashboard branch was unreachable,
 * and the only thing that ever rendered was the preview state below — while the
 * three queries kept polling at 60s/30s/30s, issuing roughly five failing
 * requests a minute for as long as the page stayed open.
 *
 * The dead queries and the unreachable dashboard are removed. The preview state
 * users actually saw is unchanged, and it stays honest about what is and is not
 * available (CRMX-001 removed fabricated metrics from this page; nothing here
 * reintroduces them).
 *
 * TO BUILD THIS FOR REAL it needs a model registry, training-job history, a
 * data-source registry and a predictions store — schema and migrations first,
 * then endpoints, then this UI. The previous scaffold is in git history if it is
 * useful as a starting sketch, but it was written against an assumed response
 * shape rather than a real one. That work is a feature, not a 404 fix, so it
 * does not belong to PROD-010.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function PredictiveAnalytics() {
  return (
    <MainLayout
      title="Predictive Analytics"
      description="AI-powered forecasting and predictive insights for your business"
    >
      <div className="max-w-md mx-auto text-center border border-dashed rounded-lg p-10 mt-8">
        <p className="font-semibold text-gray-900">Predictive Analytics is in preview</p>
        <p className="text-sm text-gray-500 mt-2">
          Forecasting models aren&apos;t connected to your data yet, so no metrics are shown. Live,
          data-backed AI is available today on the Churn Risk, Lead Scoring, and Sales Pipeline
          Forecasting pages.
        </p>
      </div>
    </MainLayout>
  );
}
