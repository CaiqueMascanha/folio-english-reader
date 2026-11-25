export type PassageAnchor = {
  text: string;
  before: string;
  after: string;
};

export type TranslationRequest = {
  text: string;
  bookId: string;
  chapter: number;
  anchor?: PassageAnchor;
};

export type TranslationResult = { translation: string };
