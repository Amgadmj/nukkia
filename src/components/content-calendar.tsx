import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  calendarDays,
  localCalendarDate,
  plannedForDay,
  plannedTitle,
  shiftCalendarDay,
  shiftCalendarMonth,
} from "@/lib/content-calendar";
import type { LibraryItem, PlanningChannel } from "@/lib/content-library";
import "./content-calendar.css";

const calendarChannels = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  website: "Site",
  undecided: "Canal a definir",
} as const;
const zones = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Noronha",
  "America/Argentina/Buenos_Aires",
  "Europe/Lisbon",
  "UTC",
];
export function CalendarTimezone({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      Fuso horário
      <select
        className="quick-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {[...new Set([value, ...zones])].map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ContentCalendar({
  items,
  allItems,
  month,
  onMonth,
  activeId,
  onSelect,
  onPlan,
}: {
  items: LibraryItem[];
  allItems: LibraryItem[];
  month: string;
  onMonth: (month: string) => void;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onPlan: (
    id: string,
    version: number,
    date: string,
    channel: PlanningChannel,
    timing: { time: string; timezone: string },
  ) => boolean;
}) {
  const today = localCalendarDate();
  const [selectedDay, setSelectedDay] = useState(today);
  const day = selectedDay.startsWith(month) ? selectedDay : `${month}-01`;
  const [view, setView] = useState<"month" | "day">("month");
  const [adding, setAdding] = useState(false);
  const [itemId, setItemId] = useState("");
  const [version, setVersion] = useState(0);
  const [time, setTime] = useState("09:00");
  const [zone, setZone] = useState("America/Sao_Paulo");
  const [channel, setChannel] = useState<PlanningChannel>("instagram");
  const focusDay = useRef(false);
  const calendar = useRef<HTMLDivElement>(null);
  const entries = plannedForDay(items, day);
  const available = allItems.filter((item) => !item.archived);
  const chosen = available.find((item) => item.id === itemId);
  const selectedVersion = chosen?.versions.some((saved) => saved.version === version)
    ? version
    : chosen?.versions.at(-1)?.version;
  useEffect(() => {
    if (focusDay.current)
      calendar.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus();
    focusDay.current = false;
  }, [day]);
  function selectDay(value: string) {
    setSelectedDay(value);
    if (!value.startsWith(month)) onMonth(value.slice(0, 7));
    onSelect(null);
  }
  const label = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
      new Date(`${value}T12:00:00Z`),
    );
  return (
    <section className="content-calendar" aria-label="Calendário de conteúdo">
      <div className="calendar-toolbar">
        <div className="calendar-month-controls">
          <button
            className="quick-secondary"
            aria-label={view === "day" ? "Dia anterior" : "Mês anterior"}
            onClick={() => {
              if (view === "day") selectDay(shiftCalendarDay(day, -1));
              else onMonth(shiftCalendarMonth(month, -1));
              onSelect(null);
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 aria-live="polite">
            {view === "day"
              ? label(day, { day: "numeric", month: "long" })
              : label(`${month}-01`, { month: "long", year: "numeric" })}
          </h2>
          <button
            className="quick-secondary"
            aria-label={view === "day" ? "Próximo dia" : "Próximo mês"}
            onClick={() => {
              if (view === "day") selectDay(shiftCalendarDay(day, 1));
              else onMonth(shiftCalendarMonth(month, 1));
              onSelect(null);
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-view-controls">
          <button className="quick-secondary" onClick={() => selectDay(today)}>
            Hoje
          </button>
          <button
            className="quick-secondary"
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Mês
          </button>
          <button
            className="quick-secondary"
            aria-pressed={view === "day"}
            onClick={() => setView("day")}
          >
            Dia
          </button>
        </div>
      </div>
      {view === "month" && (
        <div className="calendar-month-scroll" ref={calendar}>
          <div className="calendar-weekdays" aria-hidden="true">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div className="calendar-month-grid">
            {calendarDays(month).map((date) => {
              const scheduled = plannedForDay(items, date);
              return (
                <div
                  className="calendar-cell"
                  data-outside={!date.startsWith(month)}
                  data-selected={date === day}
                  key={date}
                >
                  <button
                    className="calendar-date"
                    data-day={date}
                    tabIndex={date === day ? 0 : -1}
                    aria-current={date === today ? "date" : undefined}
                    aria-pressed={date === day}
                    aria-label={`${label(date, { day: "numeric", month: "long", year: "numeric" })}, ${scheduled.length} conteúdo(s)`}
                    onClick={() => selectDay(date)}
                    onKeyDown={(event) => {
                      const offsets: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      };
                      if (event.key in offsets) {
                        event.preventDefault();
                        focusDay.current = true;
                        selectDay(shiftCalendarDay(date, offsets[event.key]!));
                      }
                    }}
                  >
                    {Number(date.slice(-2))}
                  </button>
                  <div className="calendar-bubbles">
                    {scheduled.map((item) => (
                      <button
                        className="calendar-bubble"
                        key={item.id}
                        aria-label={`${item.plan!.time || "Sem horário"} — ${plannedTitle(item)} — ${calendarChannels[item.plan!.channel ?? "undecided"]}`}
                        onClick={() => {
                          selectDay(date);
                          onSelect(item.id);
                        }}
                      >
                        <span>{item.plan!.time || "Sem horário"}</span>
                        <strong>{plannedTitle(item)}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <section className="calendar-day" aria-label="Conteúdos do dia">
        <div className="calendar-day-heading">
          <h2>{label(day, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <button
            className="quick-secondary"
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
          >
            <Plus size={16} /> Planejar conteúdo
          </button>
        </div>
        <p className="calendar-caption">
          Horários locais no fuso de cada item. Planejado · envio automático não conectado.
        </p>
        {entries.length ? (
          <div className="calendar-day-list">
            {entries.map((item) => (
              <button
                key={item.id}
                className="calendar-day-entry"
                aria-pressed={activeId === item.id}
                onClick={() => onSelect(item.id)}
              >
                <time dateTime={`${day}${item.plan!.time ? `T${item.plan!.time}` : ""}`}>
                  {item.plan!.time || "Sem horário"}
                </time>
                <span>
                  <strong>{plannedTitle(item)}</strong>
                  <small>
                    {calendarChannels[item.plan!.channel ?? "undecided"]} · versão{" "}
                    {item.plan!.version} · Planejado
                    {item.plan!.timezone ? ` · ${item.plan!.timezone!.replaceAll("_", " ")}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="calendar-empty">Nenhum conteúdo planejado para este dia.</p>
        )}
        {adding && (
          <form
            className="calendar-plan-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                chosen &&
                selectedVersion &&
                onPlan(chosen.id, selectedVersion, day, channel, { time, timezone: zone })
              ) {
                onSelect(chosen.id);
                setAdding(false);
              }
            }}
          >
            <h3>Planejar uma versão salva</h3>
            <label>
              Conteúdo
              <select
                className="quick-input"
                required
                value={itemId}
                onChange={(event) => {
                  setItemId(event.target.value);
                  setVersion(0);
                }}
              >
                <option value="">Escolha na biblioteca</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            {!available.length && <p>Guarde uma versão na biblioteca para planejar sua entrega.</p>}
            {chosen && (
              <label>
                Versão
                <select
                  className="quick-input"
                  value={selectedVersion}
                  onChange={(event) => setVersion(Number(event.target.value))}
                >
                  {chosen.versions.map((saved) => (
                    <option key={saved.version} value={saved.version}>
                      Versão {saved.version}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {chosen?.plan && (
              <p role="status">
                Este item já tem uma data. Confirmar move o planejamento para{" "}
                {label(day, { day: "numeric", month: "long" })}; as versões salvas permanecem
                intactas.
              </p>
            )}
            <label>
              Horário
              <input
                className="quick-input"
                type="time"
                value={time}
                onInput={(event) => setTime(event.currentTarget.value)}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            <CalendarTimezone value={zone} onChange={setZone} />
            <label>
              Canal
              <select
                className="quick-input"
                value={channel}
                onChange={(event) => setChannel(event.target.value as PlanningChannel)}
              >
                {Object.entries(calendarChannels).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="workspace-actions">
              <button className="quick-primary" type="submit" disabled={!chosen}>
                Confirmar planejamento
              </button>
              <button className="quick-secondary" type="button" onClick={() => setAdding(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </section>
  );
}
