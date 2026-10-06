import { NukkiaLogo } from "./nukkia-logo";
import "./brand-loading.css";

export function BrandLoading() {
  return (
    <div className="nukkia-brand-loading" role="status" aria-label="Carregando seu espaço">
      <div className="nukkia-brand-loading-mark">
        <NukkiaLogo compact symbolWidth={144} />
        <p>Nukkia</p>
      </div>
    </div>
  );
}
