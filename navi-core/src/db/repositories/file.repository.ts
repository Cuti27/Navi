import type { DB } from "../client.js"
import { files } from "../schema.js"
import { eq } from "drizzle-orm"
import type { File, NewFile } from "../schema.js"

export interface FileRepository {
    create(input: NewFile): Promise<File>
    getById(id: string): Promise<File | undefined>
}

export class DrizzleFileRepository implements FileRepository {
    constructor(private readonly db: DB) {}

    async create(input: NewFile): Promise<File> {
        await this.db.insert(files).values(input)
        const file = await this.getById(input.id)
        if (!file) {
            throw new Error("Failed to create file")
        }
        return file
    }

    async getById(id: string): Promise<File | undefined> {
        const result = await this.db.query.files.findFirst({
            where: eq(files.id, id),
        })
        return result
    }
}
