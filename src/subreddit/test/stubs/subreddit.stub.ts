import type { Subreddit } from '../../../subreddit/subreddit.schema';

export const stubSubreddit = (): Subreddit => ({
  name: 'subreddit',
  type: 'strict',
  usersPermissions: 0,
  acceptPostingRequests: false,
  allowPostCrosspost: true,
  collapseDeletedComments: false,
  commentScoreHideMins: 0,
  archivePosts: false,
  allowMultipleImages: true,
  spoilersEnabled: true,
  suggestedCommentSort: 'None',
  acceptFollowers: true,
  over18: false,
  allowImages: true,
  allowVideos: true,
  acceptingRequestsToJoin: true,
  communityTopics: [],
  requirePostFlair: false,
  postTextBodyRule: 0,
  restrictPostTitleLength: false,
  banPostBodyWords: false,
  postBodyBannedWords: [],
  banPostTitleWords: false,
  postTitleBannedWords: [],
  requireWordsInPostTitle: false,
  postGuidelines: '',
  welcomeMessageEnabled: false,
  flairList: [],
  description: '',
  icon: '',
  welcomeMessageText: '',
});
