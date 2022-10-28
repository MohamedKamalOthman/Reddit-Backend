import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;
@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;
  @Prop({
    required: true,
    unique: true,
  })
  email: string;
  @Prop({ required: true })
  hashPassword: string;
  @Prop()
  age: number;
  // default value and enum values will be added
  @Prop({ enum: [], default: '' })
  suggestedSort: string;
  // moderator access is given to specific users
  @Prop({ enum: ['user', 'admin', 'moderator'], default: 'user' })
  authType: string;
}

export const UserSchema = (() => {
  const schema = SchemaFactory.createForClass(User);
  schema.post(/save|^find/, (doc: UserDocument, next: () => void) => {
    doc.hashPassword = undefined;
    next();
  });
  schema.methods.correctPassword = async (
    userPass: string,
    hashedPass: string,
  ) => await bcrypt.compare(userPass, hashedPass);
  return schema;
})();
