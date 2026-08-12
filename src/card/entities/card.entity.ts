import { Category } from 'src/category/entities/category.entity';
import { User } from 'src/user/entities/user.entity';
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

  @Column({ type: 'text', nullable: true })
  explanation!: string;

  @Column({ default: false })
  createdByAi!: boolean;

  // --- SRS поля ---
  @Column({ type: 'float', default: 2.5 })
  easeFactor!: number;

  @Column({ default: 0 })
  repetitions!: number;

  @Column({ default: 0 })
  interval!: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextReviewDate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReviewedAt!: Date | null;

  @Column({ default: false })
  isLeech!: boolean;

  @ManyToOne(() => Category, (category) => category.cards, {
    onDelete: 'SET NULL',
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
