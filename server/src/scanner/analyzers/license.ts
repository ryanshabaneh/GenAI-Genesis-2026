import fs from 'fs'
import path from 'path'
import type { Analyzer, AnalyzerContext } from './base'
import type { AnalyzerResult, Task } from '../../types'

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']

export const licenseAnalyzer: Analyzer = {
  buildingId: 'license',

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const hasLicenseFile = LICENSE_FILES.some((name) =>
      fs.existsSync(path.join(ctx.repoPath, name))
    )

    const hasLicenseField =
      ctx.packageJson !== null &&
      typeof ctx.packageJson['license'] === 'string' &&
      ctx.packageJson['license'].length > 0

    const tasks: Task[] = [
      { id: 'license-file', label: 'LICENSE file exists', done: hasLicenseFile },
      { id: 'license-pkg', label: 'license field in package.json', done: hasLicenseField },
    ]

    const percent = tasks.filter((t) => t.done).length * 50

    return {
      buildingId: 'license',
      percent,
      tasks,
      details: { hasLicenseFile, hasLicenseField },
    }
  },
}
