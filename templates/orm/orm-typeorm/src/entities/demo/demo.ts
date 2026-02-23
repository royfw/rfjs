import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  QueryDeepPartialEntity,
  UpdateDateColumn,
} from 'typeorm';
// import { EnumContentType } from './types';

export type DemoEntityInsert = QueryDeepPartialEntity<DemoEntity>;

@Entity({
  name: 'demo',
})
export class DemoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    nullable: false,
    length: 100,
  })
  content!: string;

  // @Column({
  //   type: 'varchar',
  //   enum: EnumContentType,
  //   nullable: false,
  //   length: 100,
  // })
  // contentType!: EnumContentType;

  @Column({ type: 'boolean' })
  complete!: boolean;

  @CreateDateColumn()
  createdAt!: string;

  @UpdateDateColumn()
  updatedAt!: string;
}
