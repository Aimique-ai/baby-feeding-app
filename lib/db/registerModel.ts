import mongoose, { Model, Schema } from "mongoose";

/**
 * HMR-safe Mongoose model registration.
 *
 * Why: Under `next dev`, modules are re-imported on every change. A naive
 * `mongoose.model(name, schema)` throws OverwriteModelError on the second
 * import because the model is already registered on the (process-global)
 * mongoose instance. We reuse the existing model when present.
 */
export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (
    (mongoose.models[name] as Model<T> | undefined) ??
    mongoose.model<T>(name, schema)
  );
}
