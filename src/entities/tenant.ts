import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Tenant {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column()
    name!: string

    @Column({ type: "enum", enum: ["agency", "farmer_org"] })
    type!: "agency" | "farmer_org"

    @Column({ type: "enum", enum: ["Pakistan", "India", "Kenya"] })
    country!: "Pakistan" | "India" | "Kenya"

    @CreateDateColumn()
    created_at!: Date
}