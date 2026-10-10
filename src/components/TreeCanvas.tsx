import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";
import type { TreeLayout } from "../utils/treeLayout";
import { TreeRenderer, type TreeRendererHandlers } from "../utils/treeRenderer";

export interface TreeCanvasHandle {
  centerOn: (id: string) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

interface Props extends TreeRendererHandlers {
  ref?: Ref<TreeCanvasHandle>;
  layout: TreeLayout;
  selectedIds: string[];
  /** The view goes back to its starting position whenever this changes. */
  homeKey: string;
  /** Person kept in sight by the starting position. */
  homeId: string | null;
  label: string;
}

/** Thin React shell around TreeRenderer, which owns the canvas. */
const TreeCanvas = ({ ref, layout, selectedIds, homeKey, homeId, label, ...handlers }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<TreeRenderer | null>(null);
  const latest = useRef(handlers);

  useLayoutEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const r = new TreeRenderer(canvasRef.current!, miniRef.current, {
      onPersonClick: (...a) => latest.current.onPersonClick(...a),
      onPersonDoubleClick: (...a) => latest.current.onPersonDoubleClick(...a),
      onPersonContextMenu: (...a) => latest.current.onPersonContextMenu(...a),
      onPaneClick: () => latest.current.onPaneClick(),
      onToggleFold: (...a) => latest.current.onToggleFold(...a),
    });
    renderer.current = r;
    return () => {
      r.destroy();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    renderer.current?.setLayout(layout, homeKey, homeId);
  }, [layout, homeKey, homeId]);

  useEffect(() => {
    renderer.current?.setSelected(selectedIds);
  }, [selectedIds]);

  useImperativeHandle(
    ref,
    () => ({
      centerOn: (id) => renderer.current?.centerOn(id),
      fit: () => renderer.current?.fit(),
      zoomBy: (factor) => renderer.current?.zoomBy(factor),
    }),
    []
  );

  return (
    <>
      <canvas ref={canvasRef} className="tree-canvas" role="img" aria-label={label} />
      <canvas ref={miniRef} className="tree-mini floating" aria-hidden="true" />
    </>
  );
};

export default TreeCanvas;
