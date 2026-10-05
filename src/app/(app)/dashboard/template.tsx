/** Elke Analytics-tab komt zacht op bij wisselen (template remount per navigatie). */
export default function AnalyticsTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
