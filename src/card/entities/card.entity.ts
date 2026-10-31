import { Category } from 'src/category/entities/category.entity';
import { User } from 'src/user/entities/user.entity';
import { AiGenerationLevel } from 'src/ai/ai-generation-level.enum';
import { State as FsrsState } from 'ts-fsrs';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity()
@Unique(['user', 'word', 'sourceLanguage', 'targetLanguage'])
@Index(['user', 'nextReviewDate'])
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  word!: string;

  @Column()
  sourceLanguage!: string;

  @Column()
  targetLanguage!: string;

  @Column()
  translation!: string;

  @Column({
    name: 'transcription',
    type: 'varchar',
    nullable: true,
    length: 255,
  })
  transcription!: string | null;

  @Column({ type: 'text', nullable: true })
  explanation!: string;

  @Column({ type: 'text', nullable: true })
  example!: string | null;

  @Column({ default: false })
  createdByAi!: boolean;

  @Column({
    type: 'enum',
    enum: AiGenerationLevel,
    enumName: 'card_level_enum',
    nullable: true,
  })
  level!: AiGenerationLevel | null;

  // --- SRS поля ---
  @Column({ default: 0 })
  repetitions!: number;

  @Column({ default: 0 })
  interval!: number;

  @Column({ name: 'fsrsDue', type: 'timestamptz', nullable: true })
  nextReviewDate!: Date | null;

  @Column({ type: 'double precision', nullable: true, select: false })
  fsrsStability!: number | null;

  @Column({ type: 'double precision', nullable: true, select: false })
  fsrsDifficulty!: number | null;

  @Column({ type: 'smallint', nullable: true, select: false })
  fsrsStatus!: FsrsState | null;

  @Column({ type: 'integer', nullable: true, select: false })
  fsrsElapsedDays!: number | null;

  @Column({ type: 'integer', nullable: true, select: false })
  fsrsLearningSteps!: number | null;

  @Column({ type: 'integer', nullable: true, select: false })
  fsrsLapses!: number | null;

  @Column({ default: false })
  isLeech!: boolean;

  @ManyToOne(() => Category, (category) => category.cards, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  category!: Category | null;

  @ManyToOne(() => User, (user) => user.cards, { onDelete: 'CASCADE' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
