/**
 * Compatibility shim for the generated Supabase `Database` type.
 *
 * `src/types/database.ts` is generated/maintained via `supabase gen types`
 * and declares each table/view `Row` as a plain `interface`. Starting with
 * the postgrest-js version bundled in @supabase/supabase-js >= 2.46, the
 * `GenericSchema`/`GenericTable` constraints the client uses to resolve query
 * result types require every `Row`, `Insert` and `Update` shape to be
 * assignable to `Record<string, unknown>`.
 *
 * A bare `interface` has no implicit index signature, so it is NOT assignable
 * to `Record<string, unknown>`; when the schema fails that constraint the
 * client falls back to `Schema = never` and every `.from(...)` call resolves
 * to `never` (producing the "Property 'x' does not exist on type 'never'" and
 * "not assignable to parameter of type 'never'" errors across the app).
 *
 * Rewriting a type through a homomorphic mapped type (`{ [K in keyof T]: T[K] }`)
 * gives it the implicit index signature, which satisfies the constraint.
 * `NormalizeDatabase` applies that rewrite to every table/view `Row` without
 * touching the generated source file. The runtime shape is unchanged; this is
 * purely a type-level transform consumed by `createClient<...>()`.
 */

/** Rewrite an object type as a mapped type so it gains an index signature. */
type NormalizeRow<Row> = { [K in keyof Row]: Row[K] };

/** Normalize the `Row` member of every table/view in a `Tables`/`Views` map. */
type NormalizeRelations<Relations> = {
  [Name in keyof Relations]: Relations[Name] extends { Row: infer Row }
    ? Omit<Relations[Name], 'Row'> & { Row: NormalizeRow<Row> }
    : Relations[Name];
};

/** Normalize `Tables` and `Views` within a single schema, leaving the rest. */
type NormalizeSchema<Schema> = {
  [Key in keyof Schema]: Key extends 'Tables' | 'Views'
    ? NormalizeRelations<Schema[Key]>
    : Schema[Key];
};

/**
 * Normalize an entire `Database` type so each schema's table/view rows satisfy
 * postgrest-js's `Record<string, unknown>` row constraint.
 */
export type NormalizeDatabase<DB> = {
  [Schema in keyof DB]: NormalizeSchema<DB[Schema]>;
};
