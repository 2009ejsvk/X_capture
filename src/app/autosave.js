const DRAFT_KEY = "x-capture:draft:v1";
const MAX_DRAFT_CHARS = 4_200_000;

const DRAFT_STATE_KEYS = [
  "sourceUrl",
  "authorName",
  "authorHandle",
  "replyParents",
  "quoteAuthorName",
  "quoteAuthorHandle",
  "quoteAuthorProfileImageSrc",
  "quoteText",
  "quoteDataUrls",
  "replyCount",
  "retweetCount",
  "likeCount",
  "bookmarkCount",
  "showReply",
  "showReplyMedia",
  "showQuote",
  "showQuoteMedia",
  "quoteMediaLayout",
  "tweetDate",
  "tweetText",
  "translationText",
  "profileImageSrc",
  "mediaLayout",
  "imageDataUrls",
  "stylePreset",
  "exportFormat",
  "exportScale",
];

function getStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function pickDraftState(state) {
  return DRAFT_STATE_KEYS.reduce((draftState, key) => {
    if (Object.hasOwn(state, key)) {
      draftState[key] = state[key];
    }
    return draftState;
  }, {});
}

function withoutMedia(draft) {
  const state = { ...draft.state };
  state.profileImageSrc = "";
  state.imageDataUrls = [];
  state.quoteAuthorProfileImageSrc = "";
  state.quoteDataUrls = [];
  state.replyParents = Array.isArray(state.replyParents)
    ? state.replyParents.map((reply) => ({
        ...reply,
        authorProfileImageSrc: "",
        dataUrls: [],
      }))
    : [];

  return {
    ...draft,
    mediaStored: false,
    state,
  };
}

function stringifyDraft(draft) {
  const text = JSON.stringify(draft);
  if (text.length <= MAX_DRAFT_CHARS || draft.mediaStored === false) {
    return text;
  }

  return JSON.stringify(withoutMedia(draft));
}

export function saveDraft({ state, tweetUrl, storage } = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage || !state) {
    return false;
  }

  const draft = {
    version: 1,
    savedAt: Date.now(),
    mediaStored: true,
    tweetUrl: String(tweetUrl || ""),
    state: pickDraftState(state),
  };

  try {
    targetStorage.setItem(DRAFT_KEY, stringifyDraft(draft));
    return true;
  } catch (error) {
    try {
      targetStorage.setItem(DRAFT_KEY, JSON.stringify(withoutMedia(draft)));
      return true;
    } catch (fallbackError) {
      return false;
    }
  }
}

export function loadDraft(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) {
    return null;
  }

  try {
    const rawDraft = targetStorage.getItem(DRAFT_KEY);
    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft);
    if (!draft || draft.version !== 1 || !draft.state) {
      return null;
    }

    return draft;
  } catch (error) {
    return null;
  }
}

export function applyDraftToState(state, draft) {
  if (!state || !draft || !draft.state) {
    return false;
  }

  DRAFT_STATE_KEYS.forEach((key) => {
    if (Object.hasOwn(draft.state, key)) {
      state[key] = draft.state[key];
    }
  });

  return true;
}

export function clearDraft(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    // Storage cleanup is best-effort.
  }
}
