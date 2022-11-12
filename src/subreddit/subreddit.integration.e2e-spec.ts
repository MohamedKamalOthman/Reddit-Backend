import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { readFile, unlink } from 'fs/promises';
import request from 'supertest';

import { AllExceptionsFilter } from '../utils/all-exception.filter';
import { ImagesHandlerModule } from '../utils/imagesHandler/images-handler.module';
import {
  closeInMongodConnection,
  rootMongooseTestModule,
} from '../utils/mongoose-in-memory';
import type { CreateSubredditDto } from './dto/create-subreddit.dto';
import type { FlairDto } from './dto/flair.dto';
import type { UpdateSubredditDto } from './dto/update-subreddit.dto';
import { SubredditController } from './subreddit.controller';
import { SubredditSchema } from './subreddit.schema';
import { SubredditService } from './subreddit.service';

jest.mock('../utils/mail/mail.service.ts');
describe('subredditController (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const invalidId = '6363fba4ab2c2f94f3ac9f37';
  const createSubreddit: CreateSubredditDto = {
    name: 'subreddit',
    over18: false,
    type: 'public',
  };
  const dummySubreddit: CreateSubredditDto = {
    name: 'dummy_subreddit',
    over18: false,
    type: 'public',
  };
  const defaultFields = {
    __v: 0,
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
    allowImages: true,
    allowVideos: true,
    postTitleBannedWords: [],
    postBodyBannedWords: [],
    communityTopics: [],
    acceptingRequestsToJoin: true,
    requirePostFlair: false,
    postTextBodyRule: 0,
    restrictPostTitleLength: false,
    banPostBodyWords: false,
    banPostTitleWords: false,
    requireWordsInPostTitle: false,
    postGuidelines: '',
    welcomeMessageEnabled: false,
    flairList: [],
  };

  const createDummySubreddit = async () => {
    const req = await request(server).post('/subreddit').send(dummySubreddit);

    return req.body;
  };

  let sr;
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        rootMongooseTestModule(),
        ImagesHandlerModule,
        MongooseModule.forFeature([
          { name: 'Subreddit', schema: SubredditSchema },
        ]),
      ],
      controllers: [SubredditController],
      providers: [SubredditService],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    server = app.getHttpServer();
    sr = await createDummySubreddit();
  });
  it('should be defined', () => {
    expect(app).toBeDefined();
  });
  describe('/POST /subreddit', () => {
    it('must create subreddit successfully', async () => {
      const res = await request(server)
        .post('/subreddit')
        .send(createSubreddit);
      expect(res.body).toEqual({
        ...defaultFields,
        ...createSubreddit,
        _id: res.body._id,
      });
    });
    it('must throw duplicate error', async () => {
      const res = await request(server)
        .post('/subreddit')
        .send(createSubreddit);
      expect(res.body.message).toBe(
        'E11000 duplicate key error collection: test.subreddits index: name_1 dup key: { name: "subreddit" }',
      );
    });
    it('must throw error leckage of data', async () => {
      const res = await request(server)
        .post('/subreddit')
        .send({ over18: true, type: 'public' });
      expect(res.body.message).toEqual(
        'Subreddit validation failed: name: Path `name` is required.',
      );
    });
  });

  describe('/GET /subreddit/:subreddit', () => {
    it('must return a subreddit successfully', async () => {
      const res = await request(server).get(`/subreddit/${sr._id}`);
      expect(res.body).toEqual({
        ...sr,
      });
    });
    it('must throw error not found', async () => {
      const res = await request(server).get(`/subreddit/${invalidId}`);
      expect(res.body.message).toEqual('No subreddit with such id');
    });
  });

  describe('/Patch /subreddit/:subreddit', () => {
    it('must return a subreddit successfully', async () => {
      const updatedFields: UpdateSubredditDto = {
        acceptFollowers: false,
        type: 'private',
      };
      const res = await request(server)
        .patch(`/subreddit/${sr._id}`)
        .send(updatedFields);
      expect(res.body).toEqual({
        status: 'success',
      });
    });
    it('must throw error no such subreddit exist', async () => {
      const updatedFields: UpdateSubredditDto = {
        acceptFollowers: false,
        type: 'public',
      };
      const res = await request(server)
        .patch(`/subreddit/${invalidId}`)
        .send(updatedFields);
      expect(res.body.message).toEqual('No subreddit with such id');
    });
  });
  let flairId: string;
  describe('/POST /subreddit/:subreddit/flair', () => {
    const flair: FlairDto = {
      backgroundColor: 'aaa321',
      textColor: 'fff',
      text: 'welcome',
    };
    it('must create a flair successfully', async () => {
      const res = await request(server)
        .post(`/subreddit/${sr._id}/flair`)
        .send(flair);
      flairId = res.body.flairList[0]._id.toString();
      expect(res.body).toEqual({
        _id: res.body._id,
        flairList: [
          {
            ...flair,
            _id: flairId,
          },
        ],
      });
    });
    it('must throw error subreddit is not exist', async () => {
      const res = await request(server)
        .post(`/subreddit/${invalidId}/flair`)
        .send(flair);
      expect(res.body.message).toEqual('No subreddit with such id');
    });
  });

  describe('/DELETE /subreddit/:subreddit/flair', () => {
    it('must delete a flair successfully', async () => {
      const res = await request(server).delete(
        `/subreddit/${sr._id}/flair/${flairId}`,
      );
      expect(res.body).toEqual({ status: 'success' });
    });
    it("must throw error subreddit doesn't exist", async () => {
      const res = await request(server).delete(
        `/subreddit/${invalidId}/flair/${flairId}`,
      );
      expect(res.body.message).toEqual('No subreddit with such id');
    });
  });

  describe('/POST /subreddit/:subreddit/icon', () => {
    it('must upload a photo successfully', async () => {
      const res = await request(server)
        .post(`/subreddit/${sr._id}/icon`)
        .attach('icon', __dirname + '/test/photos/testingPhoto.jpeg');
      expect(typeof (await readFile(res.body.icon))).toBe('object');
      expect(res.body).toEqual({
        icon: res.body.icon,
      });
      await unlink(res.body.icon);
    });
    it("must throw error subreddit doesn't exist", async () => {
      const res = await request(server)
        .post(`/subreddit/${invalidId}/icon`)
        .attach('icon', __dirname + '/test/photos/testingPhoto.jpeg');
      expect(res.body.message).toEqual('No subreddit with such id');
    });
    it('must throw error subreddit no icon provided', async () => {
      const res = await request(server).post(`/subreddit/${sr._id}1/icon`);
      expect(res.body.message).toEqual('File is required');
    });
  });

  describe('/DELETE /subreddit/:subreddit/icon', () => {
    it('The Icon removed successfully', async () => {
      await request(server)
        .post(`/subreddit/${sr._id}/icon`)
        .attach('icon', __dirname + '/test/photos/testingPhoto.jpeg');
      const res = await request(server).delete(`/subreddit/${sr._id}/icon`);
      expect(res.body).toEqual({
        status: 'success',
      });
    });
    it("must throw error subreddit doesn't exist", async () => {
      const res = await request(server).delete(`/subreddit/${invalidId}/icon`);
      expect(res.body.message).toEqual('No subreddit with such id');
    });
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
    server.close();
  });
});
