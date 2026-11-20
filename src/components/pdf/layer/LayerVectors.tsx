/**
 * Marks drawn as SVG in one normalised 0–100 viewBox (ink, shapes, lines, brackets, area highlights)
 * and the live preview of whatever is being dragged (moved verbatim from AnnotationLayer).
 */

import React from 'react';
import {
  Annotation,
  BracketSide,
  FractionPoint,
  FractionRect,
  LINE_KINDS,
  PdfTool,
  StrokeStyle,
  blackoutBoxFromPoints,
  bracketPath,
  dashArray,
  inkArrowHead,
  inkArrowShaft,
  pointsToPolyline
} from '../annotationModel';
import { DEFAULT_WEIGHT } from './layerHelpers';

export interface LayerVectorsProps {
  activeColor: string;
  annotations: Annotation[];
  bracketBoxFrom: (a: FractionPoint, b: FractionPoint) => FractionRect;
  draftBox: FractionRect | null;
  draftEnd: FractionPoint | null;
  draftStart: FractionPoint | null;
  draftStroke: FractionPoint[] | null;
  draftWidth: number;
  handleMarkClick: (e: React.MouseEvent, annotation: Annotation) => void;
  live: (a: Annotation) => Annotation;
  marksClickable: boolean;
  pageWidth: number;
  pageHeight: number;
  strokeProps: (a: Annotation) => { stroke: string; strokeWidth: number; strokeDasharray: string | undefined; strokeLinecap: "round"; vectorEffect: "non-scaling-stroke"; filter: string | undefined; };
  tool: PdfTool;
  toolBracketSide: BracketSide | undefined;
  toolStrokeStyle: StrokeStyle | undefined;
  toolWeight: number | undefined;
}

export const LayerVectors: React.FC<LayerVectorsProps> = ({ activeColor, annotations, bracketBoxFrom, draftBox, draftEnd, draftStart, draftStroke, draftWidth, handleMarkClick, live, marksClickable, pageWidth, pageHeight, strokeProps, tool, toolBracketSide, toolStrokeStyle, toolWeight }) => (
  <>
      {/* Vector marks share one normalized 0–100 viewBox, so the same path data scales with the
          page. `vector-effect` keeps strokes a constant visual weight instead of ballooning with
          zoom, and `preserveAspectRatio="none"` lets the square viewBox stretch to the real page
          shape so a mark stays where it was drawn on a non-square page. */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >

        {annotations.map((raw) => {
          const a = live(raw);
          const interactive: React.CSSProperties = {
            pointerEvents: marksClickable ? 'stroke' : 'none',
            cursor: 'pointer'
          };
          // `data-mark-ui` marks everything that is part of manipulating an annotation, so the
          // properties strip knows not to treat a press on it as "the reader moved on".
          const marker = { 'data-mark-ui': '' };

          if (a.kind === 'ink' && a.points && a.points.length > 1) {
            const stroke = strokeProps(a);
            // Freehand arrow: the head is a solid triangle, never dashed, clickable like the stroke.
            const head = a.arrowHead ? inkArrowHead(a.points, a.weight ?? DEFAULT_WEIGHT, pageWidth, pageHeight) : null;
            return (
              <g key={a.id} {...marker} data-arrow-head={head ? '' : undefined}>
                <polyline
                  points={pointsToPolyline(a.arrowHead ? inkArrowShaft(a.points, a.weight ?? DEFAULT_WEIGHT) : a.points)}
                  fill="none"
                  {...stroke}
                  strokeLinejoin="round"
                  style={interactive}
                  onClick={(e) => handleMarkClick(e, raw)}
                />
                {head && (
                  <polygon
                    points={head}
                    fill={a.color}
                    filter={stroke.filter}
                    style={{ ...interactive, pointerEvents: marksClickable ? 'fill' : 'none' }}
                    onClick={(e) => handleMarkClick(e, raw)}
                  />
                )}
              </g>
            );
          }

          if ((a.kind === 'arrow' || a.kind === 'line') && a.from && a.to) {
            const stroke = strokeProps(a);
            // The head is the freehand arrow's: a solid triangle worked out in pixels, never dashed.
            const head = a.kind === 'arrow' ? inkArrowHead([a.from, a.to], a.weight ?? DEFAULT_WEIGHT, pageWidth, pageHeight) : null;
            return (
              <g key={a.id} {...marker} data-arrow-head={head ? '' : undefined}>
                <line
                  x1={a.from.x * 100}
                  y1={a.from.y * 100}
                  x2={a.to.x * 100}
                  y2={a.to.y * 100}
                  {...stroke}
                  style={interactive}
                  onClick={(e) => handleMarkClick(e, raw)}
                />
                {head && (
                  <polygon
                    points={head}
                    fill={a.color}
                    filter={stroke.filter}
                    style={{ ...interactive, pointerEvents: marksClickable ? 'fill' : 'none' }}
                    onClick={(e) => handleMarkClick(e, raw)}
                  />
                )}
              </g>
            );
          }

          if (a.kind === 'bracket' && a.box) {
            return (
              <path
                key={a.id}
                {...marker}
                d={bracketPath(a.box, a.bracketSide ?? 'left')}
                fill="none"
                {...strokeProps(a)}
                strokeLinejoin="round"
                style={interactive}
                onClick={(e) => handleMarkClick(e, raw)}
              />
            );
          }

          if (a.kind === 'ellipse' && a.box) {
            return (
              <ellipse
                key={a.id}
                {...marker}
                cx={(a.box.x + a.box.w / 2) * 100}
                cy={(a.box.y + a.box.h / 2) * 100}
                rx={(a.box.w / 2) * 100}
                ry={(a.box.h / 2) * 100}
                fill="none"
                {...strokeProps(a)}
                style={interactive}
                onClick={(e) => handleMarkClick(e, raw)}
              />
            );
          }

          if (a.kind === 'rect' && a.box) {
            return (
              <rect
                key={a.id}
                {...marker}
                x={a.box.x * 100}
                y={a.box.y * 100}
                width={a.box.w * 100}
                height={a.box.h * 100}
                fill={a.filled ? a.color : 'none'}
                {...strokeProps(a)}
                style={interactive}
                onClick={(e) => handleMarkClick(e, raw)}
              />
            );
          }
          return null;
        })}

        {/* Live preview of whatever is being dragged right now. */}
        {draftStroke && draftStroke.length > 1 && (
          <polyline
            points={pointsToPolyline(tool === 'inkArrow' ? inkArrowShaft(draftStroke, toolWeight ?? DEFAULT_WEIGHT) : draftStroke)}
            fill="none"
            stroke={activeColor}
            strokeWidth={draftWidth}
            strokeDasharray={dashArray(toolStrokeStyle, draftWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftStroke && tool === 'inkArrow' && (() => {
          const head = inkArrowHead(draftStroke, toolWeight ?? DEFAULT_WEIGHT, pageWidth, pageHeight);
          return head && <polygon points={head} fill={activeColor} />;
        })()}
        {draftBox && tool === 'bracket' && (
          <path
            d={bracketPath(bracketBoxFrom(draftStart!, draftEnd!), toolBracketSide ?? 'left')}
            fill="none"
            stroke={activeColor}
            strokeWidth={draftWidth}
            strokeDasharray={dashArray(toolStrokeStyle, draftWidth)}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftBox && tool === 'area' && (
          <rect
            x={draftBox.x * 100}
            y={draftBox.y * 100}
            width={draftBox.w * 100}
            height={draftBox.h * 100}
            fill={activeColor}
            fillOpacity={0.28}
            stroke={activeColor}
            strokeDasharray="4 4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftStart && draftEnd && tool === 'mask' && (() => {
          const bar = blackoutBoxFromPoints(draftStart, draftEnd);
          return <rect x={bar.x * 100} y={bar.y * 100} width={bar.w * 100} height={bar.h * 100} fill={activeColor} fillOpacity={0.85} />;
        })()}
        {draftBox && (tool === 'rect' || tool === 'ellipse' || tool === 'text') && (
          <rect
            x={draftBox.x * 100}
            y={draftBox.y * 100}
            width={draftBox.w * 100}
            height={draftBox.h * 100}
            fill="none"
            stroke={activeColor}
            strokeDasharray="4 4"
            strokeWidth={Math.max(1, (toolWeight ?? DEFAULT_WEIGHT) * pageWidth)}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftStart && draftEnd && tool === 'arrow' && (() => {
          const head = inkArrowHead([draftStart, draftEnd], toolWeight ?? DEFAULT_WEIGHT, pageWidth, pageHeight);
          return head && <polygon points={head} fill={activeColor} />;
        })()}
        {draftStart && draftEnd && LINE_KINDS.includes(tool as never) && (
          <line
            x1={draftStart.x * 100}
            y1={draftStart.y * 100}
            x2={draftEnd.x * 100}
            y2={draftEnd.y * 100}
            stroke={activeColor}
            strokeWidth={draftWidth}
            strokeDasharray={dashArray(toolStrokeStyle, draftWidth)}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
  </>
);
