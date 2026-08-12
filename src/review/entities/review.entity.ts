import { Card } from 'src/card/entities/card.entity';
import { ReviewQuality } from 'src/common/enums/rewiev-quality.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['card', 'reviewedAt'])
export class ReviewLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Card, { onDelete: 'CASCADE' })
  card!: Card;

  @Column({ type: 'enum', enum: ReviewQuality })
  quality!: ReviewQuality;

  @Column()
  intervalBefore!: number;

  @Column()
  intervalAfter!: number;

  @Column({ type: 'float' })
  easeFactorBefore!: number;

  @Column({ type: 'float' })
  easeFactorAfter!: number;

  @Column()
  repetitionsAfter!: number;

  @CreateDateColumn()
  reviewedAt!: Date;
}
