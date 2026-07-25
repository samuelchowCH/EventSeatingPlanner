import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, Edit3, Settings2, RefreshCw, Check,
  Info, Sparkles, Sliders, Palette, Eye, ArrowRight, Paintbrush, ImageIcon, X
} from 'lucide-react';
import { TableStyle, TableTemplate, TemplateSeat } from '../types';
import { computeSafeRadius, buildDecorPrompt } from '../utils/decorationUtils';

interface StyleDesignerProps {
  onBackToWorkspace?: () => void;
  onApplyStyleToTables?: (style: TableStyle) => void;
}

const DEFAULT_STYLES: TableStyle[] = [
  {
    id: 'style_blueprint',
    name: 'Tech Blueprint',
    backgroundType: 'default',
    fillColor: '#EEF2FF',
    strokeColor: '#4F46E5',
    strokeWidth: 3,
    backgroundColor: '#F8FAFC',
    gridOpacity: 0.1,
    isPredefined: true
  },
  {
    id: 'style_chinese',
    name: 'Imperial Dynasty Red',
    backgroundType: 'chinese',
    fillColor: '#C41E3A',
    strokeColor: '#FFD700',
    strokeWidth: 4,
    backgroundColor: '#FFFBEB',
    gridOpacity: 0.05,
    isPredefined: true
  },
  {
    id: 'style_hotel',
    name: 'Grand Ballroom Gold',
    backgroundType: 'hotel',
    fillColor: '#F5E6CC',
    strokeColor: '#9E8A63',
    strokeWidth: 3.5,
    backgroundColor: '#FAF7F0',
    gridOpacity: 0.04,
    isPredefined: true
  },
  {
    id: 'style_western',
    name: 'Rustic Western Wood',
    backgroundType: 'western',
    fillColor: '#4A2E1B',
    strokeColor: '#D2B48C',
    strokeWidth: 4,
    backgroundColor: '#FAF5EF',
    gridOpacity: 0.03,
    isPredefined: true
  },
  {
    id: 'style_wedding',
    name: 'Dreamy Blush Wedding',
    backgroundType: 'wedding',
    fillColor: '#FFE4E1',
    strokeColor: '#B76E79',
    strokeWidth: 3,
    backgroundColor: '#FFF9F9',
    gridOpacity: 0.05,
    isPredefined: true
  }
];

const PRESET_PROMPTS = [
  { label: 'Emerald Forest', prompt: 'An organic deep emerald forest wedding with sage leaf accents and glittering warm bronze contours.' },
  { label: 'Midnight Starry Gala', prompt: 'A stellar corporate celebration under a midnight navy velvet drape, with glowing warm gold wireframe contours and starry diamond sparkles.' },
  { label: 'Oceanic Breeze', prompt: 'A fresh outdoor beach party with serene seafoam blue tablecloths, coral orange trims, and light sand canvas textures.' },
  { label: 'Vintage Lavender Tea', prompt: 'An antique royal high tea banquet. Soft rustic lavender linen, pewter silver trims, and pastel flower sprigs.' }
];

export default function StyleDesigner({ onBackToWorkspace, onApplyStyleToTables }: StyleDesignerProps) {
  const [styles, setStyles] = useState<TableStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('style_blueprint');
  const [templates, setTemplates] = useState<TableTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default_circle');
  const [previewOrientation, setPreviewOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Custom prompt state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Toast / notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load styles and templates
  useEffect(() => {
    // 1. Load Styles
    const cachedStyles = localStorage.getItem('seating_planner_styles');
    if (cachedStyles) {
      try {
        setStyles(JSON.parse(cachedStyles));
      } catch (e) {
        setStyles(DEFAULT_STYLES);
      }
    } else {
      setStyles(DEFAULT_STYLES);
      localStorage.setItem('seating_planner_styles', JSON.stringify(DEFAULT_STYLES));
    }

    // 2. Load Templates
    const cachedTemplates = localStorage.getItem('seating_planner_templates');
    const defaultTemplates: TableTemplate[] = [
      {
        id: 'default_circle',
        name: 'Standard Round (10 Seats)',
        shape: 'Circle',
        width: 180,
        height: 180,
        radius: 90,
        seats: Array.from({ length: 10 }, (_, i) => {
          const angle = (i * 2 * Math.PI) / 10 - Math.PI / 2;
          return {
            id: `seat_def_circle_${i}`,
            label: `S${i + 1}`,
            x: Math.round(200 + 115 * Math.cos(angle)),
            y: Math.round(200 + 115 * Math.sin(angle)),
            rotation: Math.round((angle * 180) / Math.PI) + 90,
            side: 'Circle-around',
            type: 'Standard'
          };
        })
      },
      {
        id: 'default_rectangle',
        name: 'Presidential Rect (12 Seats)',
        shape: 'Rectangle',
        width: 220,
        height: 120,
        seats: [
          // Top row
          ...Array.from({ length: 4 }, (_, i) => ({
            id: `seat_def_rect_t_${i}`,
            label: `S${i + 1}`,
            x: 110 + i * 60,
            y: 115,
            rotation: 0,
            side: 'Top' as const,
            type: 'Standard' as const
          })),
          // Bottom row
          ...Array.from({ length: 4 }, (_, i) => ({
            id: `seat_def_rect_b_${i}`,
            label: `S${i + 5}`,
            x: 110 + i * 60,
            y: 285,
            rotation: 180,
            side: 'Bottom' as const,
            type: 'Standard' as const
          })),
          // Left side
          ...Array.from({ length: 2 }, (_, i) => ({
            id: `seat_def_rect_l_${i}`,
            label: `S${i + 9}`,
            x: 65,
            y: 160 + i * 80,
            rotation: 270,
            side: 'Left' as const,
            type: 'Standard' as const
          })),
          // Right side
          ...Array.from({ length: 2 }, (_, i) => ({
            id: `seat_def_rect_r_${i}`,
            label: `S${i + 11}`,
            x: 335,
            y: 160 + i * 80,
            rotation: 90,
            side: 'Right' as const,
            type: 'Standard' as const
          }))
        ]
      }
    ];

    if (cachedTemplates) {
      try {
        const parsed = JSON.parse(cachedTemplates) as TableTemplate[];
        if (parsed && parsed.length > 0) {
          setTemplates([...defaultTemplates, ...parsed]);
        } else {
          setTemplates(defaultTemplates);
        }
      } catch (e) {
        setTemplates(defaultTemplates);
      }
    } else {
      setTemplates(defaultTemplates);
    }
  }, []);

  // Save styles helper
  const saveStyles = (updated: TableStyle[]) => {
    setStyles(updated);
    localStorage.setItem('seating_planner_styles', JSON.stringify(updated));
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Active style getter
  const activeStyle = styles.find(s => s.id === selectedStyleId) || styles[0] || DEFAULT_STYLES[0];

  // Update style values
  const updateActiveStyle = (updates: Partial<TableStyle>) => {
    const updated = styles.map(s => {
      if (s.id === selectedStyleId) {
        return { ...s, ...updates };
      }
      return s;
    });
    saveStyles(updated);
  };

  // Add new style
  const handleCreateNewStyle = () => {
    const newStyle: TableStyle = {
      id: `style_user_${Date.now()}`,
      name: `Custom Style ${styles.length + 1}`,
      backgroundType: 'custom',
      fillColor: 'rainbow',
      strokeColor: '#374151',
      strokeWidth: 3,
      backgroundColor: '#FFFFFF',
      gridOpacity: 0.1
    };

    const updated = [...styles, newStyle];
    saveStyles(updated);
    setSelectedStyleId(newStyle.id);
    showToast(`Created style "${newStyle.name}"`, 'success');
  };

  // Delete custom style
  const handleDeleteStyle = (idToDelete: string) => {
    const styleToDelete = styles.find(s => s.id === idToDelete);
    if (styleToDelete?.isPredefined) {
      showToast('Cannot delete predefined factory styles', 'error');
      return;
    }

    const updated = styles.filter(s => s.id !== idToDelete);
    saveStyles(updated);

    // Switch active style if deleted
    if (selectedStyleId === idToDelete) {
      const nextActive = updated[0]?.id || DEFAULT_STYLES[0].id;
      setSelectedStyleId(nextActive);
    }
    showToast('Style deleted successfully', 'success');
  };

  // Generate style from AI prompt
  const handleGenerateAiStyle = async () => {
    if (!aiPrompt.trim()) {
      setErrorMsg('Please enter a descriptive theme prompt');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/gemini/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (!response.ok) {
        let customErrorMsg = 'Failed to generate style. Please try again.';
        try {
          const errText = await response.text();
          try {
            const errData = JSON.parse(errText);
            if (errData && errData.error) {
              customErrorMsg = errData.error;
            }
          } catch (_) {
            if (errText.includes('high demand') || errText.includes('503') || errText.includes('UNAVAILABLE')) {
              customErrorMsg = 'The model is currently experiencing high demand, please try later.';
            } else if (errText.includes('timeout') || errText.includes('timed out')) {
              customErrorMsg = 'The style generator connection timed out. Please try again in a moment.';
            }
          }
        } catch (_) { }
        throw new Error(customErrorMsg);
      }

      const generatedData = await response.json();

      const newStyle: TableStyle = {
        id: `style_ai_${Date.now()}`,
        name: generatedData.name || 'AI Bespoke Theme',
        backgroundType: 'custom',
        customAiPrompt: aiPrompt,
        fillColor: generatedData.fillColor || '#EEF2FF',
        strokeColor: generatedData.strokeColor || '#4F46E5',
        strokeWidth: generatedData.strokeWidth || 3,
        backgroundColor: generatedData.backgroundColor || '#F8FAFC',
        gridOpacity: generatedData.gridOpacity || 0.1
      };

      const updated = [...styles, newStyle];
      saveStyles(updated);
      setSelectedStyleId(newStyle.id);
      setAiPrompt('');
      showToast(`AI generated & applied: "${newStyle.name}"!`, 'success');
    } catch (e: any) {
      console.error(e);
      const errMsgStr = e.message || '';
      const isHighDemand = errMsgStr.includes('high demand') ||
        errMsgStr.includes('503') ||
        errMsgStr.includes('UNAVAILABLE') ||
        errMsgStr.includes('experiencing');

      const friendlyMsg = isHighDemand
        ? 'The model is currently experiencing high demand, please try later.'
        : (e.message || 'Failed to generate style. Please try again.');

      setErrorMsg(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 3 — Generate background image via /api/gemini/image
  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) {
      setErrorMsg('Please enter a descriptive theme prompt to generate a background image');
      return;
    }

    setIsGeneratingImage(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildDecorPrompt(aiPrompt) }),
      });

      if (!response.ok) {
        let msg = 'Failed to generate background image. Please try again.';
        try {
          const errData = await response.json();
          if (errData?.error) msg = errData.error;
        } catch (_) {}
        throw new Error(msg);
      }

      const data = await response.json();
      if (!data.imageUri) throw new Error('No image returned from server.');

      updateActiveStyle({ backgroundImageUri: data.imageUri });
      showToast('Background image generated!', 'success');
    } catch (e: any) {
      console.error(e);
      const msg = e.message || 'Failed to generate background image. Please try again.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Active template for live preview
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Apply style to active tables (propagates style properties to tables)
  const handleApplyToTables = () => {
    if (onApplyStyleToTables) {
      onApplyStyleToTables(activeStyle);
      showToast(`Applied "${activeStyle.name}" styling across the current seating plan`, 'success');
    } else {
      // Direct LocalStorage fallback sync for Tables
      const cachedTables = localStorage.getItem('seating_planner_tables');
      if (cachedTables) {
        try {
          const parsed = JSON.parse(cachedTables);
          const updated = parsed.map((t: any) => ({
            ...t,
            color: activeStyle.strokeColor,
            fillColor: activeStyle.fillColor,
            fontColor: activeStyle.strokeColor,
            strokeWidth: activeStyle.strokeWidth
          }));
          localStorage.setItem('seating_planner_tables', JSON.stringify(updated));
          showToast(`Applied "${activeStyle.name}" layout theme to all floorplan tables`, 'success');
          // Refresh window or trigger state callback
          if (onBackToWorkspace) {
            setTimeout(() => onBackToWorkspace(), 1000);
          }
        } catch (err) {
          showToast('Failed to apply styles directly to tables', 'error');
        }
      }
    }
  };

  // Drawing helper
  const renderTemplateShape = () => {
    if (!activeTemplate) return null;
    const center = 200;
    const shape = activeTemplate.shape;
    const radius = activeTemplate.radius || 90;
    const width = activeTemplate.width || 180;
    const height = activeTemplate.height || 120;
    const sides = activeTemplate.sides || 6;

    let fill = activeStyle.fillColor;
    if (fill === 'rainbow') {
      fill = '#F3F4F6';
    }
    let stroke = activeStyle.strokeColor;
    let strokeWidth = activeStyle.strokeWidth;

    // Predefined gradients mapping
    if (activeStyle.backgroundType === 'chinese') {
      fill = 'url(#chineseGradStyle)';
    } else if (activeStyle.backgroundType === 'hotel') {
      fill = 'url(#hotelGradStyle)';
    } else if (activeStyle.backgroundType === 'western') {
      fill = 'url(#westernGradStyle)';
    } else if (activeStyle.backgroundType === 'wedding') {
      fill = 'url(#weddingGradStyle)';
    }

    const strokeProps = {
      stroke,
      strokeWidth,
      fill,
      strokeDasharray: 'none',
      className: 'transition-all duration-300'
    };

    if (shape === 'Circle') {
      return <circle cx={center} cy={center} r={radius} {...strokeProps} />;
    }

    if (shape === 'Square') {
      return (
        <rect
          x={center - width / 2}
          y={center - width / 2}
          width={width}
          height={width}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Rectangle') {
      return (
        <rect
          x={center - width / 2}
          y={center - height / 2}
          width={width}
          height={height}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Oval') {
      return (
        <ellipse
          cx={center}
          cy={center}
          rx={width / 2}
          ry={height / 2}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Semi-circle') {
      const r = radius;
      const d = `M ${center - r} ${center + 20} A ${r} ${r} 0 0 1 ${center + r} ${center + 20} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (shape === 'Quarter circle') {
      const r = radius;
      const d = `M ${center - 50} ${center + r - 50} A ${r} ${r} 0 0 1 ${center - 50 + r} ${center - 50} L ${center - 50} ${center - 50} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (shape === 'Polygon') {
      const pts: string[] = [];
      const r = radius;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = center + r * Math.cos(angle);
        const py = center + r * Math.sin(angle);
        pts.push(`${px},${py}`);
      }
      return <polygon points={pts.join(' ')} {...strokeProps} />;
    }

    if (shape === 'Long Banquet') {
      return (
        <rect
          x={center - width / 2}
          y={center - height / 2}
          width={width}
          height={height}
          rx={8}
          {...strokeProps}
        />
      );
    }

    return null;
  };

  return (
    <div className="bg-gilded-bg min-h-screen pb-16 pt-6 text-gilded-ink font-sans">
      <div className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-none border shadow-md flex items-center gap-2.5 animate-bounce text-xs font-bold ${notification.type === 'success' ? 'bg-gilded-accent-muted text-gilded-ink border-gilded-accent' : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
            <Check size={14} className="text-gilded-ink" />
            <span>{notification.message}</span>
          </div>
        )}

        {/* Studio Top Banner */}
        <div className="bg-white border border-gilded-border rounded-none p-6 mb-6 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-gilded-accent text-gilded-ink text-[10px] font-extrabold rounded-none font-mono uppercase tracking-wider">
                Theme Studio
              </span>
              <h1 className="text-xl font-bold text-gilded-ink tracking-tight font-serif">
                Aesthetic Style Designer
              </h1>
            </div>
            <p className="text-xs text-gray-500 font-sans mt-1">
              Create, edit, and delete bespoke table visual styles. Harness server-side Gemini AI style synthesis or configure colors, borders, and grid line visibility.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {onBackToWorkspace && (
              <button
                onClick={onBackToWorkspace}
                className="px-4 py-2 bg-white border border-gilded-border hover:bg-gilded-bg text-gilded-ink text-xs font-bold rounded-none shadow-3xs transition-all cursor-pointer"
              >
                ← Back to Workspace
              </button>
            )}
            <button
              onClick={handleApplyToTables}
              className="px-4 py-2 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink text-xs font-bold rounded-none shadow-3xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Paintbrush size={13} />
              <span>Apply Theme Globally</span>
            </button>
          </div>
        </div>

        {/* Master layout grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Panel: Style list & core modifiers */}
          <div className="lg:col-span-3 space-y-6">

            {/* Style Selector List */}
            <div className="bg-white border border-gilded-border rounded-none p-5 shadow-3xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Palette size={13} className="text-gilded-accent" />
                  Visual Style Manager
                </h3>
                <button
                  onClick={handleCreateNewStyle}
                  className="px-2 py-1 bg-gilded-faint hover:bg-gilded-accent/20 border border-gilded-border text-gilded-ink text-[10px] font-bold rounded-none flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus size={10} />
                  <span>Create</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {styles.map((style) => {
                  const isActive = style.id === selectedStyleId;
                  return (
                    <div
                      key={style.id}
                      onClick={() => {
                        setSelectedStyleId(style.id);
                        setErrorMsg('');
                      }}
                      className={`group p-2.5 border rounded-none flex items-center justify-between cursor-pointer transition-all ${isActive
                          ? 'border-gilded-accent bg-gilded-accent/10 font-bold'
                          : 'border-gray-100 bg-gilded-faint hover:bg-gilded-accent/5'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className="w-3.5 h-3.5 rounded-none border border-gray-300 shrink-0"
                          style={{ backgroundColor: style.fillColor === 'rainbow' ? '#F3F4F6' : style.fillColor, borderColor: style.strokeColor }}
                        />
                        <span className="text-xs text-gilded-ink truncate">{style.name}</span>
                        {style.isPredefined && (
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded-none font-mono">
                            Preset
                          </span>
                        )}
                      </div>

                      {!style.isPredefined && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStyle(style.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-0.5 shrink-0"
                          title="Delete Custom Style"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Background Style Controls */}
            <div className="bg-white border border-gilded-border rounded-none p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sliders size={13} className="text-gilded-accent" />
                Background &amp; Outline Controls
              </h3>

              <div className="space-y-3.5 pt-1">
                {/* Style Name */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                    Style Name
                  </label>
                  <input
                    type="text"
                    value={activeStyle.name}
                    disabled={activeStyle.isPredefined}
                    onChange={(e) => updateActiveStyle({ name: e.target.value })}
                    className="w-full bg-gilded-faint border border-gilded-border rounded-none px-3 py-1.5 text-xs text-gilded-ink font-semibold disabled:opacity-60"
                  />
                </div>

                {/* Table Fill & Stroke picker */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                      Table Fill Color
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-10 h-10 shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full border border-gilded-border hover:border-gilded-accent shadow-3xs hover:shadow-xs transition-all relative flex items-center justify-center overflow-visible`}
                        >
                          <div
                            className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                            style={{
                              background: activeStyle.fillColor === 'rainbow'
                                ? 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff, #ff0000)'
                                : activeStyle.fillColor.startsWith('url') ? '#FFFFFF' : activeStyle.fillColor
                            }}
                          />
                          <input
                            type="color"
                            value={activeStyle.fillColor === 'rainbow' || activeStyle.fillColor.startsWith('url') ? '#FFFFFF' : activeStyle.fillColor}
                            disabled={activeStyle.isPredefined}
                            onChange={(e) => updateActiveStyle({ fillColor: e.target.value, backgroundType: 'custom' })}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed rounded-full bg-transparent p-0 border-0 outline-none appearance-none"
                          />
                          <div className="absolute -top-1 -right-1 bg-gilded-accent text-gilded-ink text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-extrabold border border-white shadow-3xs pointer-events-none">
                            +
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-gray-600 truncate">
                        {activeStyle.fillColor === 'rainbow' ? 'Rainbow' : activeStyle.fillColor.startsWith('url') ? 'Gradient' : activeStyle.fillColor}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                      Outline/Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-10 h-10 shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full border border-gilded-border hover:border-gilded-accent shadow-3xs hover:shadow-xs transition-all relative flex items-center justify-center overflow-visible`}
                        >
                          <div
                            className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                            style={{
                              background: activeStyle.strokeColor
                            }}
                          />
                          <input
                            type="color"
                            value={activeStyle.strokeColor}
                            disabled={activeStyle.isPredefined}
                            onChange={(e) => updateActiveStyle({ strokeColor: e.target.value })}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed rounded-full bg-transparent p-0 border-0 outline-none appearance-none"
                          />
                          <div className="absolute -top-1 -right-1 bg-gilded-accent text-gilded-ink text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-extrabold border border-white shadow-3xs pointer-events-none">
                            +
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-gray-600 truncate">
                        {activeStyle.strokeColor}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stroke Width Slider */}
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-500 font-mono mb-1">
                    <span>OUTLINE BORDER WIDTH</span>
                    <span>{activeStyle.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={activeStyle.strokeWidth}
                    disabled={activeStyle.isPredefined}
                    onChange={(e) => updateActiveStyle({ strokeWidth: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                  />
                </div>

                {/* Canvas Background Color */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                    Canvas Area Background
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-10 h-10 shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full border border-gilded-border hover:border-gilded-accent shadow-3xs hover:shadow-xs transition-all relative flex items-center justify-center overflow-visible`}
                      >
                        <div
                          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                          style={{
                            background: activeStyle.backgroundColor
                          }}
                        />
                        <input
                          type="color"
                          value={activeStyle.backgroundColor}
                          disabled={activeStyle.isPredefined}
                          onChange={(e) => updateActiveStyle({ backgroundColor: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed rounded-full bg-transparent p-0 border-0 outline-none appearance-none"
                        />
                        <div className="absolute -top-1 -right-1 bg-gilded-accent text-gilded-ink text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-extrabold border border-white shadow-3xs pointer-events-none">
                          +
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-600 truncate">
                      {activeStyle.backgroundColor}
                    </span>
                  </div>
                </div>

                {/* Blueprint grid lines visibility */}
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-500 font-mono mb-1">
                    <span>BLUEPRINT GRID OPACITY</span>
                    <span>{Math.round(activeStyle.gridOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={activeStyle.gridOpacity * 100}
                    disabled={activeStyle.isPredefined}
                    onChange={(e) => updateActiveStyle({ gridOpacity: Number(e.target.value) / 100 })}
                    className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right/Center Column: Canvas & AI Assist */}
          <div className="lg:col-span-9 space-y-4">

            {/* AI Generator Container */}
            <div className="bg-white border border-gilded-border rounded-none p-5 shadow-3xs space-y-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-gilded-accent" />
                  <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono">
                    AI Prompt Generator
                  </h3>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
                  Describe any theme or dinner environment, and Gemini AI will formulate a customized high-contrast color scheme.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Editable Prompt Area */}
                <div className="md:col-span-8 space-y-1.5">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    Bespoke Theme Description
                  </label>
                  <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full text-xs leading-relaxed border border-gilded-border bg-gilded-faint rounded-none px-2.5 py-2 focus:ring-1 focus:ring-gilded-accent focus:bg-white text-gilded-ink resize-none font-sans outline-hidden"
                    placeholder="e.g., A vintage royal botanical garden dining table with rich gold ivy borders and elegant deep emerald silk cloth..."
                  />
                  {/* Error label */}
                  {errorMsg && (
                    <p className="text-[10px] text-red-600 font-bold">{errorMsg}</p>
                  )}
                </div>

                {/* Prompt Shortcuts & Trigger */}
                <div className="md:col-span-4 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1">
                    <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wider font-mono">
                      Prompt Preset Shortcuts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_PROMPTS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setAiPrompt(preset.prompt);
                            setErrorMsg('');
                          }}
                          className="text-left py-1 px-1.5 bg-gilded-faint hover:bg-gilded-accent/10 border border-gilded-border/50 text-[9px] font-semibold text-gray-600 hover:text-gilded-ink transition-all rounded-none cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Triggers */}
                  <div className="space-y-2">
                    {/* Existing: Color Theme */}
                    <button
                      type="button"
                      onClick={handleGenerateAiStyle}
                      disabled={isGenerating || isGeneratingImage}
                      className="w-full py-1.5 bg-gilded-accent hover:bg-gilded-accent-muted disabled:bg-gilded-accent/50 text-gilded-ink font-bold text-xs rounded-none shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>AI Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          <span>Synthesize Color Theme</span>
                        </>
                      )}
                    </button>

                    {/* New: Background Image */}
                    <button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={isGenerating || isGeneratingImage}
                      className="w-full py-1.5 bg-[#2C2C2C] hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold text-xs rounded-none shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isGeneratingImage ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Rendering image...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={12} />
                          <span>Generate Background Image</span>
                        </>
                      )}
                    </button>

                    {/* Thumbnail + clear button when image exists */}
                    {activeStyle?.backgroundImageUri && (
                      <div className="flex items-center gap-2 pt-1">
                        <img
                          src={activeStyle.backgroundImageUri}
                          alt="AI background preview"
                          className="w-[72px] h-[50px] object-cover border border-gilded-border rounded-none shadow-xs flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-mono text-gray-500 truncate">Background image applied</p>
                          <button
                            type="button"
                            onClick={() => updateActiveStyle({ backgroundImageUri: undefined })}
                            className="mt-0.5 flex items-center gap-0.5 text-[9px] text-red-500 hover:text-red-700 font-bold cursor-pointer transition-colors"
                          >
                            <X size={9} />
                            Clear image
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Canvas Area Container - Mock PDF Page representation */}
            <div
              className="bg-slate-100 border border-gilded-border p-6 shadow-inner flex flex-col items-center justify-start min-h-[600px] gap-6"
            >
              {/* Live Preview Controls */}
              <div className="bg-white border border-gilded-border rounded-none p-4 shadow-sm space-y-3 w-full max-w-[700px]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-gilded-faint rounded-none text-gilded-accent">
                      <Eye size={15} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-sans">
                        Live Preview Template
                      </h3>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Configure template geometry &amp; orientation
                      </p>
                    </div>
                  </div>

                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="bg-white border border-gilded-border text-xs text-gilded-ink font-bold font-sans rounded-none px-2.5 py-1.5 focus:ring-1 focus:ring-gilded-accent cursor-pointer w-full sm:w-auto"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    Export Orientation Preview
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPreviewOrientation('landscape')}
                      className={`px-3 py-1 text-[10px] font-mono rounded-none border transition-all cursor-pointer ${previewOrientation === 'landscape'
                          ? 'bg-gilded-accent border-gilded-accent text-gilded-ink font-bold'
                          : 'bg-white border-gilded-border text-gray-400 hover:text-gilded-ink'
                        }`}
                    >
                      Landscape
                    </button>
                    <button
                      onClick={() => setPreviewOrientation('portrait')}
                      className={`px-3 py-1 text-[10px] font-mono rounded-none border transition-all cursor-pointer ${previewOrientation === 'portrait'
                          ? 'bg-gilded-accent border-gilded-accent text-gilded-ink font-bold'
                          : 'bg-white border-gilded-border text-gray-400 hover:text-gilded-ink'
                        }`}
                    >
                      Portrait
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`bg-white border border-gray-300 p-2 shadow-md flex flex-col items-center justify-between transition-all duration-300 w-full ${previewOrientation === 'landscape' ? 'aspect-[297/210] max-w-[700px]' : 'aspect-[210/297] max-w-[480px]'
                  }`}
              >
                {/* Mock PDF Header */}
                <div className="w-full text-center select-none pointer-events-none mb-1 pt-1">
                  <span className="block text-[9px] font-bold text-gray-800 tracking-tight">
                    Visual Layout - {activeTemplate?.name || 'Table Template'}
                  </span>
                  <span className="block text-[7px] text-gray-400 font-medium font-mono">
                    Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | Table 1 of 1
                  </span>
                  <div className="h-[0.5px] bg-gray-200 w-full mt-1.5" />
                </div>

                {/* Central Workspace Table Canvas (representing the table element screenshot) */}
                <div
                  className={`relative border border-gilded-border rounded-none overflow-hidden transition-all duration-300 bg-slate-50/10 flex items-center justify-center ${previewOrientation === 'landscape'
                      ? 'w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] md:w-[420px] md:h-[420px] lg:w-[460px] lg:h-[460px]'
                      : 'w-[260px] h-[260px] sm:w-[350px] sm:h-[350px] md:w-[410px] md:h-[410px] lg:w-[430px] lg:h-[430px]'
                    }`}
                  style={{ backgroundColor: activeStyle.backgroundColor }}
                >
                  {/* Blueprint grid layout background */}
                  <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                    style={{
                      backgroundImage: 'radial-gradient(#2C2C2C 1.5px, transparent 1.5px)',
                      backgroundSize: '16px 16px',
                      opacity: activeStyle.gridOpacity
                    }}
                  />

                  {/* Central Workspace Canvas */}
                  <svg
                    viewBox="0 0 400 400"
                    className="w-full h-full select-none"
                  >
                    <defs>
                      <linearGradient id="chineseGradStyle" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#C41E3A" />
                        <stop offset="50%" stopColor="#A61022" />
                        <stop offset="100%" stopColor="#730514" />
                      </linearGradient>
                      <linearGradient id="hotelGradStyle" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FDFBF7" />
                        <stop offset="50%" stopColor="#F5E6CC" />
                        <stop offset="100%" stopColor="#E3D1B4" />
                      </linearGradient>
                      <linearGradient id="westernGradStyle" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4A2E1B" />
                        <stop offset="50%" stopColor="#361F10" />
                        <stop offset="100%" stopColor="#221105" />
                      </linearGradient>
                      <linearGradient id="weddingGradStyle" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFF9F9" />
                        <stop offset="50%" stopColor="#FFE4E1" />
                        <stop offset="100%" stopColor="#FFD1DC" />
                      </linearGradient>

                      {/* Step 4 — SVG Safety Mask: white rect + black circle punch-out */}
                      {activeStyle?.backgroundImageUri && (() => {
                        const sr = computeSafeRadius(
                          activeTemplate?.seats ?? [],
                          200, 200, 30
                        );
                        return (
                          <mask id="decorSafeZoneMask">
                            <rect width="400" height="400" fill="white" />
                            <circle cx="200" cy="200" r={sr} fill="black" />
                          </mask>
                        );
                      })()}
                    </defs>

                    {/* Step 4 — Background image layer with SVG safety mask applied */}
                    {activeStyle?.backgroundImageUri && (
                      <image
                        href={activeStyle.backgroundImageUri}
                        x="0" y="0" width="400" height="400"
                        preserveAspectRatio="xMidYMid slice"
                        mask="url(#decorSafeZoneMask)"
                      />
                    )}

                    {/* Outer coordinate rulers / visual aids */}
                    <line x1="200" y1="10" x2="200" y2="390" stroke={activeStyle.strokeColor} strokeWidth="0.5" strokeDasharray="3,3" className="opacity-30" />
                    <line x1="10" y1="200" x2="390" y2="200" stroke={activeStyle.strokeColor} strokeWidth="0.5" strokeDasharray="3,3" className="opacity-30" />

                    {/* Render Custom Base Table Geometry */}
                    {renderTemplateShape()}

                    {/* Center branding/labeling */}
                    <text
                      x="200"
                      y="200"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="font-mono text-[11px] font-extrabold select-none pointer-events-none"
                      fill={activeStyle.strokeColor}
                      opacity="0.8"
                    >
                      {activeTemplate?.name || 'bespoke table'}
                    </text>

                    {/* Render Visual Seat Rings/Chairs */}
                    {activeTemplate?.seats.map((seat) => {
                      return (
                        <g
                          key={seat.id}
                          transform={`translate(${seat.x}, ${seat.y}) rotate(${seat.rotation})`}
                        >
                          {/* Direction Arrow Indicator on each seat to show seating direction */}
                          <polygon
                            points="-4,-14 0,-18 4,-14"
                            fill={activeStyle.strokeColor}
                            opacity="0.7"
                          />

                          {/* Back-support arc representing a top-down chair boundary */}
                          <path
                            d="M -11 0 A 11 11 0 0 1 11 0"
                            fill="none"
                            stroke={activeStyle.strokeColor}
                            strokeWidth="1.5"
                            opacity="0.8"
                          />

                          {/* Visual Chair Body */}
                          <circle
                            r="12"
                            fill={activeStyle.strokeColor}
                            stroke={activeStyle.fillColor === 'rainbow' ? '#F3F4F6' : activeStyle.fillColor.startsWith('url') ? '#FFFFFF' : activeStyle.fillColor}
                            strokeWidth="1.5"
                            opacity="0.9"
                          />

                          {/* Mini text representing short label e.g., "S1" */}
                          <text
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            y="1"
                            className="font-mono text-[9.5px] font-bold pointer-events-none select-none"
                            fill={activeStyle.fillColor === 'rainbow' ? '#F3F4F6' : activeStyle.fillColor.startsWith('url') ? '#FFFFFF' : activeStyle.fillColor}
                          >
                            {seat.label.substring(0, 3)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Status footer for visual grid */}
              <div className="w-full flex justify-between items-center text-[10px] font-mono mt-3 px-1 text-gray-500">
                <span>Active Style: {activeStyle.name}</span>
                <span>Chairs: {activeTemplate?.seats.length || 0}</span>
              </div>
            </div>

            {/* Note box */}
            <div className="bg-white border border-gilded-border p-3 flex items-start gap-2.5 text-[11px] text-gray-500 leading-normal">
              <Info size={14} className="text-gilded-accent shrink-0 mt-0.5" />
              <div>
                <strong className="text-gilded-ink block font-sans">Apply Globally Note</strong>
                Clicking "Apply Theme Globally" will automatically set the border colors, backgrounds, and fonts of all active tables on the floorplan to match the current style properties.
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
