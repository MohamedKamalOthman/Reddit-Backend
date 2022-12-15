import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Types } from 'mongoose';
import mongoose, { Model } from 'mongoose';

// import { PostService } from '../post/post.service';
import { PostCommentService } from '../post-comment/post-comment.service';
import { UserService } from '../user/user.service';
import { ApiFeaturesService } from '../utils/apiFeatures/api-features.service';
import { ImagesHandlerService } from '../utils/imagesHandler/images-handler.service';
import { subredditSelectedFields } from '../utils/project-selected-fields';
import {
  srGetUsersRelated,
  srPagination,
  srProjectionNumOfUsersAndIfIamJoined,
  srProjectionNumOfUsersAndIfModerator,
} from '../utils/subreddit-aggregate-stages';
import type { CreateSubredditDto } from './dto/create-subreddit.dto';
import type { FilterSubredditDto } from './dto/filter-subreddit.dto';
import type { FlairDto } from './dto/flair.dto';
import type { RuleDto } from './dto/rule.dto';
import type { UpdateRuleDto } from './dto/update-rule.dto';
import type { UpdateSubredditDto } from './dto/update-subreddit.dto';
import type { Subreddit, SubredditDocument } from './subreddit.schema';
import type { SubredditUser } from './subreddit-user.schema';
@Injectable()
export class SubredditService {
  constructor(
    @InjectModel('Subreddit')
    private readonly subredditModel: Model<Subreddit>,
    @InjectModel('UserSubreddit')
    private readonly userSubredditModel: Model<SubredditUser>,
    private readonly userService: UserService,
    private readonly imagesHandlerService: ImagesHandlerService,
    private readonly apiFeatureService: ApiFeaturesService,
    private readonly postCommentService: PostCommentService,
  ) {}

  async create(
    createSubredditDto: CreateSubredditDto,
    username: string,
  ): Promise<SubredditDocument> {
    let subreddit: SubredditDocument | undefined;

    try {
      subreddit = await this.subredditModel.create({
        ...createSubredditDto,
        moderators: [username],
      });
    } catch (error) {
      if (error?.message?.startsWith('E11000')) {
        throw new ConflictException(
          `Subreddit with name ${createSubredditDto.name} already exists.`,
        );
      }

      throw error;
    }

    return subreddit;
  }

  async findSubreddit(subreddit: string): Promise<SubredditDocument> {
    const sr: SubredditDocument | null | undefined =
      await this.subredditModel.findById(subreddit);

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return sr;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findSubredditByName(subredditName: string, userId?) {
    let username;

    if (userId) {
      const user = await this.userService.getUserById(userId);
      username = user.username;
    }

    const sr = await this.subredditModel.aggregate([
      { $match: { name: subredditName } },
      srGetUsersRelated,
      srProjectionNumOfUsersAndIfModerator(userId, username),
      { $unset: 'moderators' },
    ]);

    if (sr.length === 0) {
      throw new NotFoundException('No subreddit with such name');
    }

    return { ...sr[0], joined: Boolean(sr[0].joined) };
  }

  async checkSubredditAvailable(subredditName: string) {
    const filter: FilterSubredditDto = { name: subredditName };
    const isSubredditUnavailable = await this.subredditModel.exists(filter);

    if (isSubredditUnavailable) {
      throw new ConflictException('Subreddit name is unavailable');
    }

    return { status: 'success' };
  }

  async update(subreddit: string, updateSubredditDto: UpdateSubredditDto) {
    const sr: SubredditDocument | null | undefined = await this.subredditModel
      .findByIdAndUpdate(subreddit, updateSubredditDto)
      .select('_id');

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return {
      status: 'success',
    };
  }

  async createFlair(
    subreddit: string,
    flairDto: FlairDto,
  ): Promise<SubredditDocument> {
    flairDto._id = new mongoose.Types.ObjectId();
    const sr: SubredditDocument | null | undefined = await this.subredditModel
      .findByIdAndUpdate(
        subreddit,
        {
          $push: { flairList: flairDto },
        },
        { new: true },
      )
      .select('flairList');

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return sr;
  }

  async getFlairs(subreddit: string): Promise<SubredditDocument> {
    const sr = await this.subredditModel
      .findById(subreddit)
      .select('flairList');

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return sr;
  }

  async uploadIcon(subreddit: string, file) {
    const sr = await this.subredditModel.findById(subreddit).select('_id');

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return this.imagesHandlerService.uploadPhoto(
      'subreddit_icons',
      file,
      this.subredditModel,
      new mongoose.Types.ObjectId(subreddit),
      'icon',
    );
  }

  async removeIcon(subreddit: string) {
    const saveDir = `src/statics/subreddit_icons/${subreddit}.jpeg`;
    const sr = await this.subredditModel
      .findByIdAndUpdate(subreddit, {
        icon: '',
      })
      .select('');

    if (!sr) {
      throw new NotFoundException('No subreddit with such id');
    }

    return this.imagesHandlerService.removePhoto(saveDir);
  }

  async deleteFlairById(subreddit: string, flair_id: string) {
    const flair = await this.subredditModel.findByIdAndUpdate(subreddit, {
      $pull: {
        flairList: { _id: new mongoose.Types.ObjectId(flair_id) },
      },
    });

    if (!flair) {
      throw new NotFoundException('No subreddit with such id');
    }

    return { status: 'success' };
  }

  private async subredditExist(subredditId): Promise<boolean> {
    return (await this.subredditModel.count({ _id: subredditId })) > 0;
  }

  async joinSubreddit(userId: Types.ObjectId, subredditId: Types.ObjectId) {
    const subredditExist = await this.subredditExist(subredditId);

    if (!subredditExist) {
      throw new BadRequestException(
        `there is no subreddit with id ${subredditId}`,
      );
    }

    await this.userSubredditModel.create({
      subredditId,
      userId,
    });

    return { status: 'success' };
  }

  async leaveSubreddit(userId: Types.ObjectId, subredditId: Types.ObjectId) {
    const deleted = await this.userSubredditModel.findOneAndDelete({
      userId,
      subredditId,
    });

    if (!deleted) {
      throw new BadRequestException(
        `user with id ${userId} not joined subreddit with id ${subredditId}`,
      );
    }

    return { status: 'success' };
  }

  getHotSubreddits(_subreddit: string) {
    return 'Waiting for api features to use the sort function';
  }

  private getSrCommonStages(userId, page, limit) {
    return [
      {
        $project: {
          ...subredditSelectedFields,
          srId: '$_id',
        },
      },
      srGetUsersRelated,
      srProjectionNumOfUsersAndIfIamJoined(userId),
      ...srPagination(page, limit),
    ];
  }

  async getSubredditStartsWithChar(
    searchPhrase: string,
    username,
    userId,
    page = 1,
    numberOfData = 50,
  ) {
    const res = await this.subredditModel.aggregate([
      {
        $match: {
          $and: [
            { name: new RegExp(`^${searchPhrase}`, 'i') },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { 'bannedUsers.username': { $ne: username } },
          ],
        },
      },
      ...this.getSrCommonStages(userId, page, numberOfData),
    ]);

    return res.map((v) => ({ ...v, joined: Boolean(v.joined) }));
  }

  async getSearchSubredditAggregation(
    searchPhrase: string,
    username,
    userId,
    pageNumber = 1,
    numberOfData = 50,
  ) {
    const res = await this.subredditModel.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { name: { $regex: searchPhrase, $options: 'i' } },
                { description: { $regex: searchPhrase, $options: 'i' } },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { 'bannedUsers.username': { $ne: username } },
          ],
        },
      },
      ...this.getSrCommonStages(userId, pageNumber, numberOfData),
    ]);

    return res.map((v) => ({ ...v, joined: Boolean(v.joined) }));
  }

  getSearchFlairsAggregate(
    searchPhrase: string,
    subreddit: Types.ObjectId,
    page = 1,
    limit = 50,
  ) {
    return this.subredditModel.aggregate([
      {
        $match: {
          _id: subreddit,
        },
      },
      {
        $project: {
          flair: '$flairList',
        },
      },
      {
        $unwind: '$flair',
      },
      {
        $match: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'flair.text': { $regex: searchPhrase, $options: 'i' },
        },
      },
      {
        $skip: ((Number(page) || 1) - 1) * Number(limit),
      },
      {
        $limit: Number(limit),
      },
    ]);
  }

  async addSubredditCategories(
    subreddit: Types.ObjectId,
    username: string,
    categories: string[],
  ) {
    const sr = await this.subredditModel.updateOne(
      {
        _id: subreddit,
        moderators: username,
      },
      {
        $addToSet: { categories: { $each: categories } },
      },
    );

    if (!sr.modifiedCount) {
      throw new BadRequestException();
    }

    return {
      status: 'success',
    };
  }

  getSubredditsWithCategory(category: string, page?: number, limit?: number) {
    return this.apiFeatureService.processQuery(
      this.subredditModel.find({
        categories: category,
      }),
      { page, limit },
      { pagination: true },
    );
  }

  private modifiedCountResponse(modifiedCount, message?) {
    if (modifiedCount === 0) {
      throw new BadRequestException(message);
    }

    return {
      status: 'success',
    };
  }

  async addNewModerator(
    moderatorUsername: string,
    newModuratorUsername: string,
    subreddit: Types.ObjectId,
  ) {
    const res = await this.subredditModel.updateOne(
      {
        moderators: moderatorUsername,
        _id: subreddit,
      },
      {
        $addToSet: { moderators: newModuratorUsername },
      },
    );

    if (res.matchedCount === 0) {
      throw new UnauthorizedException();
    }

    return this.modifiedCountResponse(
      res.modifiedCount,
      'You are already a moderator in that subreddit',
    );
  }

  async subredditIModerate(username: string) {
    return this.subredditModel.find({
      moderators: username,
    });
  }

  async checkIfModerator(subredditId: Types.ObjectId, username: string) {
    const moderator = await this.subredditModel.exists({
      moderators: username,
      _id: subredditId,
    });

    if (!moderator) {
      throw new UnauthorizedException(
        'you are not an moderator or wrong subreddit id',
      );
    }
  }

  async getUnModeratedThings(
    subredditId: Types.ObjectId,
    modUsername: string,
    limit: number | undefined,
    page: number | undefined,
    sort: string | undefined,
  ) {
    await this.checkIfModerator(subredditId, modUsername);

    return this.postCommentService.getUnModeratedThingsForSubreddit(
      subredditId,
      limit,
      page,
      sort,
    );
  }

  async getSpammedThings(
    subredditId: Types.ObjectId,
    modUsername: string,
    limit: number | undefined,
    page: number | undefined,
    sort: string | undefined,
  ) {
    await this.checkIfModerator(subredditId, modUsername);

    return this.postCommentService.getSpammedThingsForSubreddit(
      subredditId,
      limit,
      page,
      sort,
    );
  }

  async getEditedThings(
    subredditId: Types.ObjectId,
    modUsername: string,
    limit: number | undefined,
    page: number | undefined,
    sort: string | undefined,
  ) {
    await this.checkIfModerator(subredditId, modUsername);

    return this.postCommentService.getEditedThingsForSubreddit(
      subredditId,
      limit,
      page,
      sort,
    );
  }

  async subredditsIJoined(userId: Types.ObjectId) {
    const subreddits = await this.userSubredditModel.aggregate([
      {
        $match: {
          userId,
        },
      },
      {
        $lookup: {
          from: 'subreddits',
          localField: 'subredditId',
          foreignField: '_id',
          as: 'subreddit',
        },
      },
    ]);

    return subreddits.map((v) => v.subreddit[0]);
  }

  async getSubredditModerators(subreddit: Types.ObjectId) {
    const subreddits = await this.subredditModel.aggregate([
      {
        $match: {
          _id: subreddit,
        },
      },
      {
        $project: {
          moderators: 1,
        },
      },
      {
        $unset: '_id',
      },
      {
        $unwind: '$moderators',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'moderators',
          foreignField: 'username',
          as: 'user',
        },
      },
      {
        $project: {
          user: {
            _id: 1,
            username: 1,
            profilePhoto: 1,
            displayName: 1,
            about: 1,
          },
        },
      },
    ]);

    return subreddits.map((v) => v.user[0]);
  }

  async isJoined(userId: Types.ObjectId, subredditId: Types.ObjectId) {
    const res = await this.userSubredditModel.findOne({
      userId,
      subredditId,
    });

    return Boolean(res);
  }

  async isModerator(username: string, subreddit: Types.ObjectId) {
    const res = await this.subredditModel.findOne({
      moderators: username,
      _id: subreddit,
    });

    return Boolean(res);
  }

  async addRule(subreddit: Types.ObjectId, username: string, ruleDto: RuleDto) {
    ruleDto._id = new mongoose.Types.ObjectId();
    const res = await this.subredditModel.updateOne(
      {
        _id: subreddit,
        moderators: username,
      },
      {
        $push: { rules: ruleDto },
      },
    );

    if (!res.modifiedCount) {
      throw new NotFoundException();
    }

    return ruleDto;
  }

  async deleteRule(
    subreddit: Types.ObjectId,
    ruleId: Types.ObjectId,
    username: string,
  ) {
    const res = await this.subredditModel.updateOne(
      {
        _id: subreddit,
        moderators: username,
      },
      {
        $pull: {
          rules: { _id: ruleId },
        },
      },
    );

    return this.modifiedCountResponse(res.modifiedCount);
  }

  async updateRule(
    subreddit: Types.ObjectId,
    ruleId: Types.ObjectId,
    username: string,
    ruleDto: UpdateRuleDto,
  ) {
    const updatedObject = {};

    // eslint-disable-next-line unicorn/no-array-for-each
    Object.keys(ruleDto).forEach((key) => {
      updatedObject[`rules.$.${key}`] = ruleDto[key];
    });

    const queryObject = {
      _id: subreddit,
      moderators: username,
    };

    queryObject['rules._id'] = ruleId;

    const res = await this.subredditModel.updateOne(
      queryObject,
      {
        $set: updatedObject,
      },
      {
        runValidators: true,
      },
    );

    return this.modifiedCountResponse(res.modifiedCount);
  }

  async askToJoinSr(subreddit: Types.ObjectId, userId: Types.ObjectId) {
    const res = await this.subredditModel.updateOne(
      {
        _id: subreddit,
      },
      {
        $addToSet: {
          joinList: userId,
        },
      },
    );

    return this.modifiedCountResponse(res.modifiedCount);
  }

  async getUsersAskingToJoinSubreddit(
    subreddit: Types.ObjectId,
    moderatorUsername: string,
  ) {
    const res = await this.subredditModel.aggregate([
      {
        $match: {
          $and: [{ _id: subreddit }, { moderators: moderatorUsername }],
        },
      },
      {
        $project: {
          joinList: 1,
        },
      },
      {
        $unset: '_id',
      },
      {
        $unwind: '$joinList',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'joinList',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $project: {
          user: {
            _id: 1,
            username: 1,
            profilePhoto: 1,
            displayName: 1,
            about: 1,
          },
        },
      },
    ]);

    return res.map((v) => v.user[0]);
  }

  private async deleteUserFromAskingListIfSrExist(
    subreddit: Types.ObjectId,
    moderatorUsername: string,
    userId: Types.ObjectId,
  ) {
    const res = await this.subredditModel.updateOne(
      {
        _id: subreddit,
        moderators: moderatorUsername,
      },
      {
        $pull: {
          joinList: userId,
        },
      },
    );

    if (!res.matchedCount) {
      throw new BadRequestException();
    }

    if (!res.modifiedCount) {
      throw new BadRequestException("User didn't send request to join the sr");
    }

    return { status: 'success' };
  }

  async acceptToJoinSr(
    subredditId: Types.ObjectId,
    moderatorUsername: string,
    userId: Types.ObjectId,
  ) {
    await this.deleteUserFromAskingListIfSrExist(
      subredditId,
      moderatorUsername,
      userId,
    );

    await this.userSubredditModel.create({
      subredditId,
      userId,
    });

    return { status: 'success' };
  }

  async getUsersFromListUserDate(
    subredditId: Types.ObjectId,
    userId: string,
    fieldName: string,
  ) {
    const prjectField = {};
    prjectField[fieldName] = 1;

    // We don't have to check if the request is bad
    // eslint-disable-next-line sonarjs/prefer-immediate-return
    const res = await this.subredditModel.aggregate([
      {
        $match: {
          $and: [{ _id: subredditId }, { moderators: userId }],
        },
      },
      { $project: prjectField },
      { $unset: '_id' },
      { $unwind: `$${fieldName}` },
      {
        $lookup: {
          from: 'users',
          localField: `${fieldName}.username`,
          foreignField: 'username',
          as: 'user',
        },
      },
      {
        $project: {
          ...prjectField,
          user: {
            _id: 1,
            username: 1,
            profilePhoto: 1,
            displayName: 1,
            about: 1,
            date: 1,
          },
        },
      },
    ]);

    return res.map((v) => ({ ...v[fieldName], ...v.user[0] }));
  }

  async removeUserFromListUserDate(
    subredditId: Types.ObjectId,
    moderatorUsername: string,
    username: string,
    fieldName: string,
  ) {
    const properityObject = {};
    properityObject[fieldName] = {
      username,
    };

    const res = await this.subredditModel.updateOne(
      {
        $and: [{ _id: subredditId }, { moderators: moderatorUsername }],
      },
      {
        $pull: properityObject,
      },
    );

    return this.modifiedCountResponse(res.modifiedCount);
  }

  private async checkIfUserAlreadyProccessed(
    username: string,
    subredditId: Types.ObjectId,
    fieldName: string,
  ) {
    const filter = {};
    filter[`${fieldName}.username`] = username;
    const res = await this.subredditModel.exists({
      ...filter,
      _id: subredditId,
    });

    return Boolean(res);
  }

  async addUserToListUserDate(
    subredditId: Types.ObjectId,
    moderatorUsername: string,
    dataSent,
    fieldName: string,
    extraStage = {},
  ) {
    const { username } = dataSent;
    const isUserAlreadyProccessed = await this.checkIfUserAlreadyProccessed(
      username,
      subredditId,
      fieldName,
    );

    if (isUserAlreadyProccessed) {
      throw new BadRequestException();
    }

    const properityObject = {};
    properityObject[fieldName] = {
      ...dataSent,
      date: new Date(),
    };

    const res = await this.subredditModel.updateOne(
      {
        $and: [
          { _id: subredditId },
          { moderators: moderatorUsername },
          extraStage,
        ],
      },
      {
        $push: properityObject,
      },
    );

    return this.modifiedCountResponse(res.modifiedCount);
  }
}
