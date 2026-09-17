export type CompanyLike = { name: string; segment?: string | null };

export type BrandKitLike = {
  palette?: { cores?: string[]; nome?: string } | null;
  tone?: string | null;
  fonts?: { preset?: string } | null;
} | null;

export type ContentBrief = {
  title: string;
  format: string;
  pillar?: string | null;
  caption?: string | null;
  cta?: string | null;
};

export type CarouselSlide = {
  path: string;
  order: number;
};

export type StoryboardShot = {
  ordem: number;
  duracao_seg: number;
  narracao: string;
  visual_descricao: string;
};

export type Storyboard = {
  titulo: string;
  duracao_total_seg: number;
  shots: StoryboardShot[];
};

export type VideoRenderResult =
  { status: "awaiting_provider"; videoUrl: null } | { status: "rendered"; videoUrl: string };
