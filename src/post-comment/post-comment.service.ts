import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Types } from 'mongoose';
import { Model } from 'mongoose';

import type { Flair, Subreddit } from '../subreddit/subreddit.schema';
// import { SubredditService } from '../subreddit/subreddit.service';
import type { CreatePostCommentDto } from './dto/create-post-comment.dto';
import type { UpdatePostCommentDto } from './dto/update-post-comment.dto';
import type { PostComment } from './post-comment.schema';

@Injectable()
export class PostCommentService {
  constructor(
    @InjectModel('PostComment')
    private readonly postCommentModel: Model<PostComment>,
  ) {}

  create(_createPostCommentDto: CreatePostCommentDto) {
    return 'This action adds a new postComment';
  }

  findAll() {
    return `This action returns all postComment`;
  }

  findOne(id: number) {
    return `This action returns a #${id} postComment`;
  }

  private checkIfTheOwner(
    userId: Types.ObjectId,
    postUserId: Types.ObjectId | undefined,
  ): void | never {
    if (userId.toString() === postUserId?.toString()) {
      return;
    }

    throw new UnauthorizedException('only the owner can do this operation');
  }

  private checkIfValidFlairId(
    flairId: Types.ObjectId | undefined,
    flairs: Flair[] | undefined | null,
  ): void | never {
    if (!flairId) {
      return;
    }

    const validFlairId = flairs?.find(
      (flair) => flair._id.toString() === flairId.toString(),
    );

    if (validFlairId) {
      return;
    }

    throw new BadRequestException('flair is not included in post subreddit');
  }

  /**
   * Retrieves a comment or a post from the data base.
   * @param id the id of the thing to be retrieved
   * @param type the thing type
   * @returns a comment or post
   */
  get = async (id: Types.ObjectId, type: string) => {
    const thing: PostComment | null = await this.postCommentModel.findById(id);

    if (!thing) {
      throw new NotFoundException(`id : ${id} not found`);
    }

    if (thing.type !== type) {
      throw new BadRequestException(
        `Requested a ${type} but the id belongs to ${thing.type}`,
      );
    }

    return thing;
  };

  async update(
    id: Types.ObjectId,
    dto: UpdatePostCommentDto,
    userId: Types.ObjectId,
  ) {
    const thing: (PostComment & { subredditId: Subreddit | null }) | null =
      await this.postCommentModel
        .findById(id)
        .populate('subredditId', 'flairList');

    if (!thing) {
      throw new BadRequestException(`id : ${id} not found `);
    }

    this.checkIfTheOwner(userId, thing.userId);

    this.checkIfValidFlairId(dto.flair, thing.subredditId?.flairList);

    const updatedThing = await this.postCommentModel.findByIdAndUpdate(id, dto);

    if (!updatedThing) {
      throw new NotFoundException(`id : ${id} not found`);
    }

    return { status: 'success' };
  }

  remove(id: number) {
    return `This action removes a #${id} postComment`;
  }
}
