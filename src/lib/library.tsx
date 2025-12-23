import React from "react";
import type { BlockCategory } from './prompt';
import { Camera, Palette, Zap, Feather, Droplet, LayoutGrid, Sparkles, Wand2, Sun, Aperture, Layers3 } from 'lucide-react';

export type LibraryCategory = {
  id: BlockCategory;
  label: string;
  icon: React.ReactNode;
  topics?: string;
  searchTerm: string;
  items: Array<{ label: string; value: string; desc?: string; weight?: number }>;
};

export const LIBRARY: LibraryCategory[] = [
  {
    id: 'STYLE',
    label: 'Art & Aesthetic',
    icon: <Palette size={18} />,
    topics: 'art,design,illustration',
    searchTerm: 'art style',
    items: [
      { label: 'Cyberpunk', value: 'cyberpunk aesthetic', desc: 'Neon, high-tech, low-life' },
      { label: 'Ukiyo-e', value: 'ukiyo-e woodblock style', desc: 'Flat perspective, woodblock texture' },
      { label: 'Isometric', value: 'isometric 3D render', desc: 'Parallel projection, clean geometry' },
      { label: 'Watercolor', value: 'watercolor painting', desc: 'Soft bleeding pigments, paper grain' },
      { label: 'Film Noir', value: 'film noir style', desc: 'High-contrast, moody shadows' },
      { label: 'Studio Ghibli', value: 'whimsical hand-drawn anime style', desc: 'Lush, warm, storybook' },
      { label: 'Baroque', value: 'baroque painting', desc: 'Ornate, dramatic contrast' },
      { label: 'Photoreal', value: 'ultra photoreal', desc: 'High fidelity realism', weight: 1.2 },
      { label: 'Vintage', value: 'vintage color grading', desc: 'Faded film look' }
    ]
  },
  {
    id: 'LIGHTING',
    label: 'Lighting',
    icon: <Zap size={18} />,
    topics: 'cinematography,photography,lighting',
    searchTerm: 'lighting',
    items: [
      { label: 'Golden Hour', value: 'golden hour sunlight', desc: 'Warm, soft sun', weight: 1.1 },
      { label: 'Cinematic', value: 'cinematic lighting', desc: 'Movie-like contrast' },
      { label: 'Volumetric', value: 'volumetric god rays', desc: 'Visible light beams' },
      { label: 'Softbox', value: 'softbox studio lighting', desc: 'Diffused, even light' },
      { label: 'Chiaroscuro', value: 'chiaroscuro', desc: 'Strong light-dark contrast' },
      { label: 'Neon Rim', value: 'neon rim lighting', desc: 'Bright edge separation' }
    ]
  },
  {
    id: 'CAMERA',
    label: 'Camera & Lens',
    icon: <Camera size={18} />,
    topics: 'photography,camera,lens',
    searchTerm: 'camera lens',
    items: [
      { label: '35mm', value: '35mm lens', desc: 'Natural perspective' },
      { label: '85mm', value: '85mm portrait lens', desc: 'Flattering compression' },
      { label: 'Macro', value: 'macro shot', desc: 'Extreme close-up details' },
      { label: 'Wide', value: 'wide angle lens', desc: 'Expansive framing' },
      { label: 'Drone', value: 'drone aerial view', desc: 'High perspective' },
      { label: 'Shallow DoF', value: 'shallow depth of field, bokeh', desc: 'Subject pop' }
    ]
  },
  {
    id: 'COMPOSITION',
    label: 'Composition',
    icon: <LayoutGrid size={18} />,
    topics: 'composition,photography,design',
    searchTerm: 'composition',
    items: [
      { label: 'Rule of Thirds', value: 'rule of thirds composition', desc: 'Balanced framing' },
      { label: 'Centered', value: 'centered composition', desc: 'Iconic symmetry' },
      { label: 'Leading Lines', value: 'leading lines', desc: 'Guides the eye' },
      { label: 'Foreground Interest', value: 'foreground elements for depth', desc: 'Layered scene' },
      { label: 'Negative Space', value: 'strong negative space', desc: 'Minimal breathing room' }
    ]
  },
  {
    id: 'MOOD',
    label: 'Mood & Tone',
    icon: <Feather size={18} />,
    topics: 'mood,emotion,atmosphere',
    searchTerm: 'mood',
    items: [
      { label: 'Ethereal', value: 'ethereal atmosphere', desc: 'Light, heavenly' },
      { label: 'Ominous', value: 'ominous atmosphere', desc: 'Threatening, dark' },
      { label: 'Serene', value: 'serene atmosphere', desc: 'Calm, peaceful' },
      { label: 'Whimsical', value: 'whimsical tone', desc: 'Playful, magical' },
      { label: 'Melancholic', value: 'melancholic mood', desc: 'Quiet, pensive' }
    ]
  },
  {
    id: 'MATERIALS',
    label: 'Materials',
    icon: <Droplet size={18} />,
    topics: 'materials,texture,surfaces',
    searchTerm: 'material texture',
    items: [
      { label: 'Obsidian', value: 'obsidian surface, glossy black', desc: 'Volcanic glass' },
      { label: 'Porcelain', value: 'porcelain texture, fine cracks', desc: 'Ceramic smoothness' },
      { label: 'Brushed Metal', value: 'brushed metal, subtle scratches', desc: 'Industrial finish' },
      { label: 'Crystal', value: 'crystalline structure, refraction', desc: 'Light splitting' },
      { label: 'Smoke', value: 'wisps of smoke, translucent', desc: 'Gaseous forms' }
    ]
  },
  {
    id: 'COLOR',
    label: 'Color & Grade',
    icon: <Sun size={18} />,
    topics: 'color,grading,cinema',
    searchTerm: 'color palette',
    items: [
      { label: 'Teal & Orange', value: 'teal and orange color grading', desc: 'Blockbuster look' },
      { label: 'Monochrome', value: 'black and white, monochrome', desc: 'Noir vibe' },
      { label: 'Pastel', value: 'soft pastel palette', desc: 'Gentle colors' },
      { label: 'High Saturation', value: 'high saturation, vibrant colors', desc: 'Punchy look' }
    ]
  },
  {
    id: 'SCENE',
    label: 'Scene & World',
    icon: <Sparkles size={18} />,
    topics: 'landscape,architecture,environment',
    searchTerm: 'environment',
    items: [
      { label: 'Desert', value: 'in a vast desert landscape', desc: 'Sand, heat haze' },
      { label: 'Rainy City', value: 'rain-soaked city streets', desc: 'Reflections, wet asphalt' },
      { label: 'Fog', value: 'dense fog, atmospheric perspective', desc: 'Mystery depth' },
      { label: 'Ancient Ruins', value: 'ancient ruins, weathered stone', desc: 'History and decay' }
    ]
  },
  {
    id: 'POST',
    label: 'Post & Detail',
    icon: <Layers3 size={18} />,
    topics: 'detail,render,texture',
    searchTerm: 'high detail',
    items: [
      { label: 'Ultra Detail', value: 'intricate detail, sharp textures', desc: 'Micro detail', weight: 1.2 },
      { label: 'Film Grain', value: 'subtle film grain', desc: 'Analog texture' },
      { label: 'HDR', value: 'HDR, high dynamic range', desc: 'Punchy highlights' },
      { label: 'Motion Blur', value: 'cinematic motion blur', desc: 'Action feel' }
    ]
  }
];

export const CATEGORY_HELP: Record<BlockCategory, { discoverFlavors: string; placeholder: string }> = {
  SUBJECT: { discoverFlavors: 'ml,trg', placeholder: 'Describe your main subject clearly...' },
  SCENE: { discoverFlavors: 'ml,trg,adj', placeholder: 'Where does it happen? Environment, era, props...' },
  STYLE: { discoverFlavors: 'ml,trg,syn', placeholder: 'Art style, aesthetic, medium...' },
  COMPOSITION: { discoverFlavors: 'ml,trg', placeholder: 'Framing, placement, depth, perspective...' },
  LIGHTING: { discoverFlavors: 'ml,trg,adj', placeholder: 'Light source, direction, time of day...' },
  CAMERA: { discoverFlavors: 'ml,trg', placeholder: 'Lens, distance, angle, DoF...' },
  MOOD: { discoverFlavors: 'ml,trg,syn', placeholder: 'Mood, vibe, atmosphere...' },
  MATERIALS: { discoverFlavors: 'ml,trg,adj', placeholder: 'Surface, texture, material cues...' },
  COLOR: { discoverFlavors: 'ml,trg', placeholder: 'Palette, grading, saturation...' },
  POST: { discoverFlavors: 'ml,trg,adj', placeholder: 'Detail, render cues, film effects...' },
  NEGATIVE: { discoverFlavors: 'ml,trg', placeholder: 'Things to avoid (SDXL/Flux negative prompt)' }
};
