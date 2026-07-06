export default function GlobalLoading() {
  return (
    <div className="route-progress" role="status" aria-live="polite" aria-label="页面加载中">
      <span className="route-progress__label">正在加载下一页内容…</span>
      <div className="route-progress__track" aria-hidden="true">
        <span className="route-progress__bar" />
      </div>
    </div>
  );
}