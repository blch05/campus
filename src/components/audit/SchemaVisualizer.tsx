import { useMemo } from 'react';
import { Badge } from '../ui/Badge';

export interface ParsedColumn {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  references?: { table: string; column: string };
}

export interface ParsedTable {
  name: string;
  shortName: string;
  columns: ParsedColumn[];
}

export interface ParsedRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

function cleanIdent(raw: string): string {
  return raw.replace(/"/g, '').trim();
}

function shortTableName(name: string): string {
  const parts = cleanIdent(name).split('.');
  return parts[parts.length - 1];
}

export function parseSqlSchemaDetailed(sql: string): {
  tables: ParsedTable[];
  relations: ParsedRelation[];
} {
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];
  const regex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    const fullName = cleanIdent(match[1]);
    const shortName = shortTableName(fullName);
    const body = match[2];
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--'));

    const columns: ParsedColumn[] = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/,$/, '').trim();
      if (/^(constraint|primary\s+key|unique|check|foreign\s+key)/i.test(line)) {
        const tableFk = line.match(
          /foreign\s+key\s*\(([^)]+)\)\s*references\s+([a-z0-9_."]+)\s*\(([^)]+)\)/i,
        );
        if (tableFk) {
          relations.push({
            fromTable: shortName,
            fromColumn: cleanIdent(tableFk[1]),
            toTable: shortTableName(tableFk[2]),
            toColumn: cleanIdent(tableFk[3]),
          });
        }
        continue;
      }

      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;

      const colName = cleanIdent(tokens[0]);
      const colType = tokens[1].replace(/,$/, '');
      const isPk = /\bprimary\s+key\b/i.test(line);
      const isNotNull = /\bnot\s+null\b/i.test(line) || isPk;
      const isUnique = /\bunique\b/i.test(line);
      const refMatch = line.match(/references\s+([a-z0-9_."]+)\s*\(([^)]+)\)/i);

      let references: { table: string; column: string } | undefined;
      if (refMatch) {
        const toTable = shortTableName(refMatch[1]);
        const toColumn = cleanIdent(refMatch[2]);
        references = { table: toTable, column: toColumn };
        relations.push({
          fromTable: shortName,
          fromColumn: colName,
          toTable,
          toColumn,
        });
      }

      columns.push({
        name: colName,
        type: colType,
        isPk,
        isFk: Boolean(references),
        isNotNull,
        isUnique,
        references,
      });
    }

    tables.push({ name: fullName, shortName, columns });
  }

  return { tables, relations };
}

interface SchemaVisualizerProps {
  sql: string;
}

const BOX_W = 240;
const HEADER_H = 34;
const ROW_H = 22;
const GAP_X = 72;
const GAP_Y = 48;
const PAD = 24;

export function SchemaVisualizer({ sql }: SchemaVisualizerProps) {
  const { tables, relations } = useMemo(() => parseSqlSchemaDetailed(sql), [sql]);

  if (tables.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)]">
        No se encontraron bloques <code>CREATE TABLE ... (...);</code> en el SQL.
      </p>
    );
  }

  const colsPerRow = Math.min(3, Math.max(1, tables.length));
  const rowHeights: number[] = [];

  tables.forEach((t, idx) => {
    const r = Math.floor(idx / colsPerRow);
    const h = HEADER_H + Math.max(1, t.columns.length) * ROW_H + 12;
    rowHeights[r] = Math.max(rowHeights[r] ?? 0, h);
  });

  const positions = new Map<
    string,
    { x: number; y: number; w: number; h: number; table: ParsedTable }
  >();

  tables.forEach((t, idx) => {
    const c = idx % colsPerRow;
    const r = Math.floor(idx / colsPerRow);
    const x = PAD + c * (BOX_W + GAP_X);
    let y = PAD;
    for (let i = 0; i < r; i++) y += rowHeights[i] + GAP_Y;
    const h = HEADER_H + Math.max(1, t.columns.length) * ROW_H + 12;
    positions.set(t.shortName, { x, y, w: BOX_W, h, table: t });
  });

  const svgWidth = PAD * 2 + colsPerRow * BOX_W + Math.max(0, colsPerRow - 1) * GAP_X;
  const svgHeight =
    PAD * 2 +
    rowHeights.reduce((sum, h) => sum + h, 0) +
    Math.max(0, rowHeights.length - 1) * GAP_Y;

  const internalRelations = relations.filter(
    (rel) => positions.has(rel.fromTable) && positions.has(rel.toTable),
  );
  const externalRelations = relations.filter(
    (rel) => positions.has(rel.fromTable) && !positions.has(rel.toTable),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="neutral">{tables.length} tabla(s)</Badge>
        <Badge variant="success">{relations.length} relación(es) FK</Badge>
        <span className="text-[11px] text-[var(--text-muted)]">
          PK = Clave primaria · FK = Clave foránea · Flecha apunta de tabla hija (N) a tabla padre (1)
        </span>
      </div>

      {/* Diagrama ER en SVG */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] p-2">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block min-w-full"
          role="img"
          aria-label="Diagrama entidad-relación generado desde schema.sql"
        >
          <defs>
            <marker
              id="er-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-primary)" />
            </marker>
          </defs>

          {/* Conectores entre tablas (FK -> PK) */}
          {internalRelations.map((rel, i) => {
            const from = positions.get(rel.fromTable)!;
            const to = positions.get(rel.toTable)!;
            const fromColIdx = Math.max(
              0,
              from.table.columns.findIndex((c) => c.name === rel.fromColumn),
            );
            const toColIdx = Math.max(
              0,
              to.table.columns.findIndex((c) => c.name === rel.toColumn),
            );

            const fromY = from.y + HEADER_H + fromColIdx * ROW_H + ROW_H / 2 + 4;
            const toY = to.y + HEADER_H + toColIdx * ROW_H + ROW_H / 2 + 4;

            const goingRight = to.x >= from.x;
            const x1 = goingRight ? from.x + from.w : from.x;
            const x2 = goingRight ? to.x : to.x + to.w;
            const midX = (x1 + x2) / 2;

            const pathD =
              from.x === to.x
                ? `M ${from.x + from.w} ${fromY} C ${from.x + from.w + 42} ${fromY}, ${to.x + to.w + 42} ${toY}, ${to.x + to.w} ${toY}`
                : `M ${x1} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${x2} ${toY}`;

            return (
              <g key={`${rel.fromTable}-${rel.fromColumn}-${rel.toTable}-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--text-primary)"
                  strokeWidth="1.5"
                  strokeOpacity="0.65"
                  markerEnd="url(#er-arrow)"
                />
              </g>
            );
          })}

          {/* Cajas de tablas */}
          {Array.from(positions.values()).map(({ x, y, w, h, table }) => (
            <g key={table.shortName} transform={`translate(${x}, ${y})`}>
              <rect
                width={w}
                height={h}
                rx="8"
                fill="var(--bg-surface)"
                stroke="var(--border-strong)"
                strokeWidth="1"
              />
              <rect
                width={w}
                height={HEADER_H}
                rx="8"
                fill="var(--bg-hover)"
              />
              <line
                x1="0"
                y1={HEADER_H}
                x2={w}
                y2={HEADER_H}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x="12"
                y="21"
                fill="var(--text-primary)"
                fontSize="12"
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {table.shortName}
              </text>

              {table.columns.map((col, idx) => {
                const rowY = HEADER_H + idx * ROW_H + 17;
                const badgeText = col.isPk ? 'PK' : col.isFk ? 'FK' : '';
                return (
                  <g key={col.name}>
                    {badgeText && (
                      <text
                        x="10"
                        y={rowY}
                        fill={col.isPk ? 'var(--status-ok-fg)' : 'var(--status-warn-fg)'}
                        fontSize="9.5"
                        fontWeight="700"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {badgeText}
                      </text>
                    )}
                    <text
                      x={badgeText ? '32' : '12'}
                      y={rowY}
                      fill="var(--text-primary)"
                      fontSize="11"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {col.name.length > 18 ? `${col.name.slice(0, 17)}…` : col.name}
                    </text>
                    <text
                      x={w - 10}
                      y={rowY}
                      textAnchor="end"
                      fill="var(--text-muted)"
                      fontSize="10"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {col.type.length > 11 ? `${col.type.slice(0, 10)}…` : col.type}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Lista legible de relaciones */}
      {relations.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Mapa de relaciones (N → 1)
          </p>
          <ul className="space-y-1 font-mono text-xs text-[var(--text-secondary)]">
            {relations.map((r, idx) => (
              <li key={idx}>
                <strong className="text-[var(--text-primary)]">{r.fromTable}</strong>.{r.fromColumn}{' '}
                ──▶ <strong className="text-[var(--text-primary)]">{r.toTable}</strong>.{r.toColumn}
                {externalRelations.includes(r) && (
                  <span className="ml-2 text-[10px] text-[var(--text-muted)]">(tabla externa)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
